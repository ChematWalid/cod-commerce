import {
  isSnowflake,
  type OfferCommand,
  type OfferInput,
  offerInputSchema,
  type OfferStatus,
  type Snowflake,
} from '@cod/shared';
import { type CodeInput, parseCodes } from '../domain/code-text';
import { CODES_METHOD } from '../domain/constants';
import type { OfferKindRegistry } from '../domain/engine/kind-registry';
import {
  CodeMethodRequiredError,
  InvalidOfferConfigError,
  OfferConflictError,
  OfferNotFoundError,
} from '../domain/errors';
import { assertEditable, withStatus } from '../domain/offer-lifecycle';
import { draftOf, editedOffer, inputOf, type OfferRecord, type StoredCode } from '../domain/offer-record';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { Clock } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type {
  OfferCodeRepositoryPort,
  OfferListFilter,
  OfferRepositoryPort,
} from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { assertOnChannelOf } from './store-channel';

/** Everything the admin use case reaches the outside through. */
export interface OfferAdminPorts {
  readonly offers: OfferRepositoryPort;
  readonly codes: OfferCodeRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly clock: Clock;
  readonly kinds: OfferKindRegistry;
  /** Checks every call's `ctx` is on `scope`'s store channel (D2448). */
  readonly stores: ActiveStorePort;
}

/** A validated offer command and its configuration parsed by the kind's schema (D2404). */
interface ParsedOffer {
  readonly command: OfferCommand;
  readonly config: unknown;
}

/**
 * The offer write path without HTTP (D2431): create a draft, edit, change status, delete, read and list the offers of
 * the caller's store, and add or remove their codes. Business and store always come from `scope`, never from input,
 * and every call is refused with `NoActiveStoreError` unless `ctx` is on `scope`'s store channel (D2448), as
 * the trusted scoped pricing core is (D2408).
 */
export class OfferAdminService {
  constructor(private readonly ports: OfferAdminPorts) {}

  /**
   * Creates a draft from `input`.
   *
   * @throws {@link InvalidOfferConfigError} when the input or the kind's configuration is invalid.
   * @throws {@link UnknownOfferKindError} when no calculator handles the kind.
   */
  async createDraft(ctx: OperationContext, scope: StoreScope, input: OfferInput): Promise<OfferRecord> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const { command, config } = this.parse(input);
    const offer = draftOf({ id: this.ports.ids.next(), command, config, now: this.ports.clock.now() });
    await this.ports.offers.create(ctx, scope, offer);
    return offer;
  }

  /**
   * Applies `patch` over the offer's editable fields and bumps its version (D2424). A key given as `undefined` keeps
   * the stored value, as an absent one does.
   *
   * @throws {@link InvalidOfferTransitionError} when the offer is archived.
   * @throws {@link CodeMethodRequiredError} when the patch makes a code offer that has codes automatic (D2449).
   * @throws {@link OfferConflictError} when another write changed the offer after it was read.
   */
  async update(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    patch: Partial<OfferInput>,
  ): Promise<OfferRecord> {
    const current = await this.get(ctx, scope, rawId);
    assertEditable(current);
    const { command, config } = this.parse({ ...inputOf(current), ...definedKeysOf(patch) });
    const edited = editedOffer(current, command, config, this.ports.clock.now());
    await this.assertCodesKeepTheirMethod(ctx, scope, current, edited);
    await this.save(ctx, scope, edited, current.version);
    return edited;
  }

  /**
   * Moves the offer to `status`, recording when it was published, paused or archived.
   *
   * @throws {@link InvalidOfferTransitionError} for a move the lifecycle refuses; archived is final.
   * @throws {@link OfferConflictError} when another write changed the offer after it was read.
   */
  async setStatus(ctx: OperationContext, scope: StoreScope, rawId: string, status: OfferStatus): Promise<OfferRecord> {
    const current = await this.get(ctx, scope, rawId);
    const moved = withStatus(current, status, this.ports.clock.now());
    await this.save(ctx, scope, moved, current.version);
    return moved;
  }

  /** Deletes the offer with its targets and codes; @throws {@link OfferNotFoundError} when the store has none. */
  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const deleted = await this.ports.offers.delete(ctx, scope, offerIdOf(rawId));
    if (!deleted) throw new OfferNotFoundError();
  }

  /** The offer of the store; @throws {@link OfferNotFoundError} for a foreign, unknown or malformed id. */
  async get(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const offer = await this.ports.offers.findById(ctx, scope, offerIdOf(rawId));
    if (offer === undefined) throw new OfferNotFoundError();
    return offer;
  }

  /** The store's offers matching `filter`, newest first. */
  async list(ctx: OperationContext, scope: StoreScope, filter: OfferListFilter = {}): Promise<readonly OfferRecord[]> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    return this.ports.offers.list(ctx, scope, filter);
  }

  /**
   * Adds codes to the offer, normalised (D2406), all or none.
   *
   * @throws {@link InvalidOfferConfigError} for a malformed code; {@link CodeTakenError} for one the store has.
   * @throws {@link CodeMethodRequiredError} when the offer is not activated by codes (D2449).
   */
  async addCodes(
    ctx: OperationContext,
    scope: StoreScope,
    rawOfferId: string,
    inputs: readonly CodeInput[],
  ): Promise<readonly StoredCode[]> {
    const offer = await this.get(ctx, scope, rawOfferId);
    assertEditable(offer);
    if (offer.method !== CODES_METHOD) throw new CodeMethodRequiredError();
    const createdAt = this.ports.clock.now();
    const codes = parseCodes(inputs).map(({ code, usageLimit }) => ({
      id: this.ports.ids.next(),
      offerId: offer.id,
      code,
      usageLimit,
      usageCount: 0,
      createdAt,
    }));
    await this.ports.codes.add(ctx, scope, codes);
    return codes;
  }

  /**
   * Removes the offer's code; `false` when it has no such code.
   *
   * @throws {@link InvalidOfferTransitionError} when the offer is archived.
   */
  async removeCode(ctx: OperationContext, scope: StoreScope, rawOfferId: string, code: string): Promise<boolean> {
    const offer = await this.get(ctx, scope, rawOfferId);
    assertEditable(offer);
    return this.ports.codes.remove(ctx, scope, offer.id, code);
  }

  /** Refuses an edit that would leave codes on an automatic offer, where the engine would ignore them (D2449). */
  private async assertCodesKeepTheirMethod(
    ctx: OperationContext,
    scope: StoreScope,
    current: OfferRecord,
    edited: OfferRecord,
  ): Promise<void> {
    if (current.method !== CODES_METHOD || edited.method === CODES_METHOD) return;
    const codes = await this.ports.codes.listOf(ctx, scope, current.id);
    if (codes.length > 0) throw new CodeMethodRequiredError();
  }

  private parse(input: unknown): ParsedOffer {
    const parsed = offerInputSchema.safeParse(input);
    if (!parsed.success) throw new InvalidOfferConfigError();
    return { command: parsed.data, config: this.ports.kinds.parseConfig(parsed.data.kind, parsed.data.config) };
  }

  /**
   * Writes `offer` if it is still at `readVersion`; otherwise not-found when it is gone, or a conflict, so a write read
   * before a concurrent one never undoes it (an archive stays final, D2440).
   */
  private async save(ctx: OperationContext, scope: StoreScope, offer: OfferRecord, readVersion: number): Promise<void> {
    if (await this.ports.offers.update(ctx, scope, offer, readVersion)) return;
    const stillThere = await this.ports.offers.findById(ctx, scope, offer.id);
    throw stillThere === undefined ? new OfferNotFoundError() : new OfferConflictError();
  }
}

/** `patch` without its `undefined` keys, so spreading it over the stored fields never blanks one into a default. */
function definedKeysOf(patch: Partial<OfferInput>): Partial<OfferInput> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

/** A request's offer id, or not-found for a malformed one: it must never reach Postgres as a bigint. */
function offerIdOf(rawId: string): Snowflake {
  if (!isSnowflake(rawId)) throw new OfferNotFoundError();
  return rawId;
}
