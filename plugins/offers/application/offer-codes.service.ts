import {
  GENERATE_CODE_ROUNDS,
  type GenerateCodesCommand,
  MAX_CODES_PER_OFFER,
  type GenerateCodesInput,
  generateCodesInputSchema,
} from '@cod/shared';
import { assembleCodes } from '../domain/code-generation';
import { type CodeInput, parseCodes } from '../domain/code-text';
import { CODES_METHOD } from '../domain/constants';
import { CodeMethodRequiredError, CodeTakenError, InvalidOfferConfigError } from '../domain/errors';
import { assertEditable } from '../domain/offer-lifecycle';
import type { OfferRecord, StoredCode } from '../domain/offer-record';
import type { Clock } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { OfferCodeRepositoryPort } from '../domain/ports/offer-repository.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { RandomCodeSource } from '../domain/ports/random-code-source.port';
import type { StoreScope } from '../domain/store-scope';
import { loadOffer, type OfferAccessPorts } from './offer-access';

/** What the codes use case reaches the outside through. */
export interface OfferCodesPorts extends OfferAccessPorts {
  readonly codes: OfferCodeRepositoryPort;
  readonly ids: IdGeneratorPort;
  readonly clock: Clock;
  /** Where generated codes draw their random part (D2512). */
  readonly random: RandomCodeSource;
}

/** A code text and its own use limit, ready to store. */
interface CodeEntry {
  readonly code: string;
  readonly usageLimit: number | null;
}

/**
 * The discount codes of an offer (D2406, D2449, D2512): add, remove, list and generate. Codes belong to offers
 * activated by codes, are unique per store and written all or none. Every call is refused unless `ctx` is on
 * `scope`'s store channel (D2448).
 */
export class OfferCodesService {
  constructor(private readonly ports: OfferCodesPorts) {}

  /**
   * Adds codes to the offer, normalised (D2406), all or none.
   *
   * @throws {@link InvalidOfferConfigError} for a malformed code, or past `MAX_CODES_PER_OFFER` codes (D2535(k)).
   * @throws {@link CodeTakenError} for a code the store has.
   * @throws {@link CodeMethodRequiredError} when the offer is not activated by codes (D2449).
   * @throws {@link InvalidOfferTransitionError} when the offer is archived.
   */
  async add(
    ctx: OperationContext,
    scope: StoreScope,
    rawOfferId: string,
    inputs: readonly CodeInput[],
  ): Promise<readonly StoredCode[]> {
    const offer = await this.codeOffer(ctx, scope, rawOfferId);
    return this.store(ctx, scope, offer, parseCodes(inputs));
  }

  /** Removes the offer's code; `false` when it has none. @throws {@link InvalidOfferTransitionError} if archived. */
  async remove(ctx: OperationContext, scope: StoreScope, rawOfferId: string, code: string): Promise<boolean> {
    const offer = await loadOffer(this.ports, ctx, scope, rawOfferId);
    assertEditable(offer);
    return this.ports.codes.remove(ctx, scope, offer.id, code);
  }

  /** The offer's codes, oldest first; @throws {@link OfferNotFoundError} when the store has no such offer. */
  async list(ctx: OperationContext, scope: StoreScope, rawOfferId: string): Promise<readonly StoredCode[]> {
    const offer = await loadOffer(this.ports, ctx, scope, rawOfferId);
    return this.ports.codes.listOf(ctx, scope, offer.id);
  }

  /**
   * Generates `count` new codes behind `prefix`, each with `usageLimit` (D2512). A candidate the store already has, or
   * one drawn twice, is drawn again, for at most `GENERATE_CODE_ROUNDS` rounds.
   *
   * @throws {@link InvalidOfferConfigError} for a bad count, prefix or limit, or past `MAX_CODES_PER_OFFER` codes.
   * @throws {@link CodeMethodRequiredError} when the offer is not activated by codes (D2449).
   * @throws {@link CodeTakenError} when the rounds run out before `count` free codes were found.
   */
  async generate(
    ctx: OperationContext,
    scope: StoreScope,
    rawOfferId: string,
    input: GenerateCodesInput,
  ): Promise<readonly StoredCode[]> {
    const parsed = generateCodesInputSchema.safeParse(input);
    if (!parsed.success) throw new InvalidOfferConfigError();
    const offer = await this.codeOffer(ctx, scope, rawOfferId);
    const texts = await this.freeCodes(ctx, scope, parsed.data);
    const { usageLimit } = parsed.data;
    return this.store(
      ctx,
      scope,
      offer,
      texts.map((code) => ({ code, usageLimit })),
    );
  }

  /** The offer, editable and activated by codes, as every code write needs it. */
  private async codeOffer(ctx: OperationContext, scope: StoreScope, rawOfferId: string): Promise<OfferRecord> {
    const offer = await loadOffer(this.ports, ctx, scope, rawOfferId);
    assertEditable(offer);
    if (offer.method !== CODES_METHOD) throw new CodeMethodRequiredError();
    return offer;
  }

  /** `count` candidates the store does not hold yet, drawn in rounds; @throws {@link CodeTakenError} if they run out. */
  private async freeCodes(ctx: OperationContext, scope: StoreScope, command: GenerateCodesCommand): Promise<string[]> {
    const kept: string[] = [];
    const refused = new Set<string>();
    for (let round = 0; round < GENERATE_CODE_ROUNDS && kept.length < command.count; round += 1) {
      const request = { prefix: command.prefix, count: command.count - kept.length };
      const candidates = assembleCodes(this.ports.random, request, new Set([...kept, ...refused]));
      const stored = await this.ports.codes.findByCodes(ctx, scope, candidates);
      const taken = new Set(stored.map((code) => code.code));
      for (const candidate of candidates) {
        if (taken.has(candidate)) refused.add(candidate);
        else kept.push(candidate);
      }
    }
    if (kept.length < command.count) throw new CodeTakenError();
    return kept;
  }

  /**
   * Refuses `adding` more codes when the offer would hold more than `MAX_CODES_PER_OFFER` (D2535(k)). Two concurrent
   * adds may each pass and overshoot by at most one batch (`MAX_CODES_PER_ADD`): the cap bounds the list, not exactly.
   */
  private async assertRoomFor(ctx: OperationContext, scope: StoreScope, offer: OfferRecord, adding: number) {
    const held = (await this.ports.codes.countByOffer(ctx, scope, [offer.id])).get(offer.id) ?? 0;
    if (held + adding > MAX_CODES_PER_OFFER) throw new InvalidOfferConfigError();
  }

  /** Stores `entries` as unused codes of `offer`, all or none, within the offer's cap. */
  private async store(
    ctx: OperationContext,
    scope: StoreScope,
    offer: OfferRecord,
    entries: readonly CodeEntry[],
  ): Promise<readonly StoredCode[]> {
    await this.assertRoomFor(ctx, scope, offer, entries.length);
    const createdAt = this.ports.clock.now();
    const codes = entries.map(({ code, usageLimit }) => ({
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
}
