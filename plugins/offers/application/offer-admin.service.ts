import {
  type OfferCommand,
  type OfferInput,
  offerInputSchema,
  type OfferListOptions,
  type OfferListOptionsInput,
  offerListOptionsSchema,
  type OfferStatus,
} from '@cod/shared';
import type { CodeInput } from '../domain/code-text';
import { CODES_METHOD } from '../domain/constants';
import { fitsTargetRules, type TargetRules } from '../domain/engine/kind-registry';
import {
  CodeMethodRequiredError,
  InvalidOfferConfigError,
  InvalidOfferTargetsError,
  InvalidQuoteRequestError,
  OfferConflictError,
  OfferNotDeletableError,
  OfferNotFoundError,
} from '../domain/errors';
import { assertEditable, isDeletableStatus, moveTo } from '../domain/offer-lifecycle';
import {
  draftOf,
  editedOffer,
  inputOf,
  type OfferRecord,
  type OfferSummaryRecord,
  type StoredCode,
} from '../domain/offer-record';
import type { OfferTargetRefs } from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { ProductVariantsPort } from '../domain/ports/product-variants.port';
import { assertNoPublishProblems } from '../domain/publish-check';
import type { StoreScope } from '../domain/store-scope';
import { addedTargets } from '../domain/target-refs';
import { loadOffer, saveOffer } from './offer-access';
import { type OfferCodesPorts, OfferCodesService } from './offer-codes.service';
import { type OfferLifecyclePorts, OfferLifecycleService } from './offer-lifecycle.service';
import { assertOnChannelOf } from './store-channel';
import { assertTargetsInStore } from './target-check';

/** Everything the admin use case reaches the outside through: the lifecycle's and the codes' ports, and variants. */
export interface OfferAdminPorts extends OfferLifecyclePorts, OfferCodesPorts {
  /** The variants of a store's product, for the list filter by product (D2513). */
  readonly variants: ProductVariantsPort;
}

/** A page of the admin offer list and how many offers match in all (D2513). */
export interface OfferSummaryPage {
  readonly items: readonly OfferSummaryRecord[];
  readonly totalItems: number;
}

/** An edit of an offer: the fields to change, and the version the caller read it at, if it checks one (D2535). */
export interface OfferEdit {
  readonly patch: Partial<OfferInput>;
  readonly expectedVersion?: number;
}

/** Statuses of a live offer: an edit of one must keep it publishable (D2510). */
const LIVE_STATUSES: ReadonlySet<OfferStatus> = new Set(['active', 'paused']);

/** A validated offer command and its configuration parsed by the kind's schema (D2404). */
interface ParsedOffer {
  readonly command: OfferCommand;
  readonly config: unknown;
  readonly rules: TargetRules;
}

/**
 * The offer write path without HTTP (D2431): create a draft, edit, delete, read and list the offers of the caller's
 * store. Status moves and codes have their own use cases (`OfferLifecycleService`, `OfferCodesService`); the methods
 * here that reach them only delegate, for the P2.S4 callers. Business and store always come from `scope`, never from
 * input, and every call is refused with `NoActiveStoreError` unless `ctx` is on `scope`'s store channel (D2448), as
 * the trusted scoped pricing core is (D2408).
 */
export class OfferAdminService {
  private readonly lifecycle: OfferLifecycleService;
  private readonly codeBook: OfferCodesService;

  constructor(private readonly ports: OfferAdminPorts) {
    this.lifecycle = new OfferLifecycleService(ports);
    this.codeBook = new OfferCodesService(ports);
  }

  /**
   * Creates a draft from `input`.
   *
   * @throws {@link InvalidOfferConfigError} when the input or the kind's configuration is invalid.
   * @throws {@link UnknownOfferKindError} when no calculator handles the kind.
   * @throws {@link InvalidOfferTargetsError} when a target has a role the kind does not allow (D2501).
   * @throws {@link UnknownOfferTargetsError} when a target is no variant or product of the store (D2537).
   */
  async createDraft(ctx: OperationContext, scope: StoreScope, input: OfferInput): Promise<OfferRecord> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const { command, config } = this.parse(input);
    await assertTargetsInStore(this.ports.targets, ctx, scope, command.targets);
    const offer = draftOf({ id: this.ports.ids.next(), command, config, now: this.ports.clock.now() });
    await this.ports.offers.create(ctx, scope, offer);
    return offer;
  }

  /**
   * Applies `patch` over the offer's editable fields and bumps its version (D2424); see {@link edit}.
   */
  update(ctx: OperationContext, scope: StoreScope, rawId: string, patch: Partial<OfferInput>): Promise<OfferRecord> {
    return this.edit(ctx, scope, rawId, { patch });
  }

  /**
   * Applies the edit's `patch` over the offer's editable fields and bumps its version (D2424). A key given as
   * `undefined` keeps the stored value, as an absent one does.
   *
   * @throws {@link InvalidOfferTransitionError} when the offer is archived.
   * @throws {@link InvalidOfferTargetsError} when a target has a role the edited kind does not allow (D2501).
   * @throws {@link UnknownOfferTargetsError} when a target the edit adds is no variant or product of the store; the
   * stored ones are checked again at publish and resume (D2537).
   * @throws {@link OfferPublishInvalidError} when the edit leaves an active or paused offer incomplete (D2510).
   * @throws {@link CodeMethodRequiredError} when the patch makes a code offer that has codes automatic (D2449).
   * @throws {@link OfferConflictError} when another write changed the offer after it was read, or after the caller
   * read it at `expectedVersion` (the API's optimistic edit, D2535).
   */
  async edit(ctx: OperationContext, scope: StoreScope, rawId: string, edit: OfferEdit): Promise<OfferRecord> {
    const { patch, expectedVersion } = edit;
    const current = await this.get(ctx, scope, rawId);
    if (expectedVersion !== undefined && expectedVersion !== current.version) throw new OfferConflictError();
    assertEditable(current);
    const { command, config, rules } = this.parse({ ...inputOf(current), ...definedKeysOf(patch) });
    const now = this.ports.clock.now();
    const edited = editedOffer(current, command, config, now);
    if (LIVE_STATUSES.has(current.status)) assertNoPublishProblems(edited, rules, now);
    await assertTargetsInStore(this.ports.targets, ctx, scope, addedTargets(current.targets, edited.targets));
    await this.assertCodesKeepTheirMethod(ctx, scope, current, edited);
    await saveOffer(this.ports, ctx, scope, { offer: edited, readVersion: current.version });
    return edited;
  }

  /**
   * Moves the offer to `status` through its lifecycle move (D2510): `paused` pauses, `archived` archives and `active`
   * resumes a paused offer, with the publish checks; a draft goes live only through {@link publish}.
   *
   * @throws {@link InvalidOfferTransitionError} for a move the lifecycle refuses, `draft` to `active` included.
   * @throws {@link OfferConflictError} when another write changed the offer after it was read.
   */
  setStatus(ctx: OperationContext, scope: StoreScope, rawId: string, status: OfferStatus): Promise<OfferRecord> {
    return this.lifecycle[moveTo(status)](ctx, scope, rawId);
  }

  /** Publishes a draft with the publish checks; see `OfferLifecycleService.publish` (D2510). */
  publish(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    return this.lifecycle.publish(ctx, scope, rawId);
  }

  /**
   * Deletes a draft with its targets and codes (D2521).
   *
   * @throws {@link OfferNotFoundError} when the store has no such offer.
   * @throws {@link OfferNotDeletableError} when it was ever published: archive it instead.
   */
  async delete(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<void> {
    const offer = await this.get(ctx, scope, rawId);
    if (!isDeletableStatus(offer.status)) throw new OfferNotDeletableError();
    // The status is checked again in the delete itself, so an offer published since the read is never deleted.
    if (await this.ports.offers.delete(ctx, scope, offer.id, 'draft')) return;
    const stillThere = await this.ports.offers.findById(ctx, scope, offer.id);
    throw stillThere === undefined ? new OfferNotFoundError() : new OfferNotDeletableError();
  }

  /** The offer of the store; @throws {@link OfferNotFoundError} for a foreign, unknown or malformed id. */
  get(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<OfferRecord> {
    return loadOffer(this.ports, ctx, scope, rawId);
  }

  /**
   * A page of the store's offers, newest first, each with its code count (D2513); filters combine with AND, and
   * `productId` keeps the offers targeting the product or one of its variants.
   *
   * @throws {@link InvalidQuoteRequestError} when the options break their schema.
   */
  async list(
    ctx: OperationContext,
    scope: StoreScope,
    rawOptions: OfferListOptionsInput = {},
  ): Promise<OfferSummaryPage> {
    const parsed = offerListOptionsSchema.safeParse(rawOptions);
    if (!parsed.success) throw new InvalidQuoteRequestError();
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const { productId, ...filter } = parsed.data;
    const refs = await this.refsOf(ctx, scope, productId);
    const page = await this.ports.offers.list(ctx, scope, { ...filter, refs });
    return { items: await this.countCodes(ctx, scope, page.items), totalItems: page.totalItems };
  }

  /**
   * `offers` of the store, each with how many codes it holds, counted in one grouped read (D2513); the API answers a
   * single offer with it too.
   *
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s store channel.
   */
  async withCodeCounts(
    ctx: OperationContext,
    scope: StoreScope,
    offers: readonly OfferRecord[],
  ): Promise<readonly OfferSummaryRecord[]> {
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    return this.countCodes(ctx, scope, offers);
  }

  /** Adds codes to the offer; see `OfferCodesService.add` (D2406, D2449). */
  addCodes(
    ctx: OperationContext,
    scope: StoreScope,
    rawOfferId: string,
    inputs: readonly CodeInput[],
  ): Promise<readonly StoredCode[]> {
    return this.codeBook.add(ctx, scope, rawOfferId, inputs);
  }

  /** Removes the offer's code; see `OfferCodesService.remove`. */
  removeCode(ctx: OperationContext, scope: StoreScope, rawOfferId: string, code: string): Promise<boolean> {
    return this.codeBook.remove(ctx, scope, rawOfferId, code);
  }

  /** The offer's codes, oldest first; see `OfferCodesService.list`. */
  codesOf(ctx: OperationContext, scope: StoreScope, rawOfferId: string): Promise<readonly StoredCode[]> {
    return this.codeBook.list(ctx, scope, rawOfferId);
  }

  private async countCodes(
    ctx: OperationContext,
    scope: StoreScope,
    offers: readonly OfferRecord[],
  ): Promise<readonly OfferSummaryRecord[]> {
    const counts = await this.ports.codes.countByOffer(
      ctx,
      scope,
      offers.map((offer) => offer.id),
    );
    return offers.map((offer) => ({ ...offer, codeCount: counts.get(offer.id) ?? 0 }));
  }

  /** The product and variant ids a `productId` filter matches; none set without one. */
  private async refsOf(
    ctx: OperationContext,
    scope: StoreScope,
    productId: OfferListOptions['productId'],
  ): Promise<OfferTargetRefs | undefined> {
    if (productId === undefined) return undefined;
    const variantIds = await this.ports.variants.variantIdsOf(ctx, scope, productId);
    return { productIds: [productId], variantIds };
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

  /**
   * `input` validated, its config parsed by its kind, every target's role allowed by the kind (D2501) and no role
   * holding more targets than the kind allows (an add-on offer's products, D2505).
   */
  private parse(input: unknown): ParsedOffer {
    const parsed = offerInputSchema.safeParse(input);
    if (!parsed.success) throw new InvalidOfferConfigError();
    const { kind, config: rawConfig, targets } = parsed.data;
    const { config, rules } = this.ports.kinds.parsedWithRules(kind, rawConfig);
    if (!fitsTargetRules(targets, rules)) throw new InvalidOfferTargetsError();
    return { command: parsed.data, config, rules };
  }
}

/** `patch` without its `undefined` keys, so spreading it over the stored fields never blanks one into a default. */
function definedKeysOf(patch: Partial<OfferInput>): Partial<OfferInput> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}
