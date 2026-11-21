import {
  generateCodesInputSchema,
  type OfferAppType,
  offerInputSchema,
  offerListOptionsSchema,
  type OfferPerformance,
  type OfferPreview,
  type OfferPreviewInput,
} from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import type { CodeInput } from '../domain/code-text';
import { InvalidOfferConfigError, InvalidQuoteRequestError, OfferNotFoundError } from '../domain/errors';
import type { OfferRecord, OfferSummaryRecord } from '../domain/offer-record';
import { NO_PERFORMANCE } from '../domain/performance';
import { asOperationContext, type OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { type OfferCodeDto, type OfferPageDto, type OfferViewDto, toCodeDto, toOfferViewDto } from './offer-dto';
import { OfferReadUseCases, OfferWriteUseCases } from './offer-use-cases';
import { fieldOf, idArgOf, offerInputOf, offerPatchOf, versionOf, withoutNullFields } from './request-body';
import { scopeOf } from './store-scope-of';

/** The caller's operation context and store, as every action reads them first. */
interface Caller {
  readonly op: OperationContext;
  readonly scope: StoreScope;
}

/** The tenant from the request (never from the path or body, D2518), for the use cases. */
const callerOf = (ctx: RequestContext): Caller => ({ op: asOperationContext(ctx), scope: scopeOf(ctx) });

/** A status move of the lifecycle use case (D2510, D2511). */
type LifecycleMove = 'publish' | 'pause' | 'resume' | 'archive' | 'duplicate';

/**
 * One path per offer action for both API surfaces (D2517-D2519): take the tenant from the request, parse what the use
 * case does not, run the use case and shape the answer with its code count and performance. Handlers only add their
 * permission and error mapping.
 */
@Injectable()
export class OfferActions {
  constructor(
    private readonly writes: OfferWriteUseCases,
    private readonly reads: OfferReadUseCases,
  ) {}

  /** A page of the store's offers; @throws {@link InvalidQuoteRequestError} for options breaking their schema. */
  async list(ctx: RequestContext, options: unknown): Promise<OfferPageDto> {
    const caller = callerOf(ctx);
    const parsed = offerListOptionsSchema.safeParse(options ?? {});
    if (!parsed.success) throw new InvalidQuoteRequestError();
    const page = await this.writes.admin.list(caller.op, caller.scope, parsed.data);
    return { items: await this.viewsOf(caller, page.items), totalItems: page.totalItems };
  }

  /** The store's offer, or `null` for an unknown, foreign or malformed id. */
  async get(ctx: RequestContext, id: unknown): Promise<OfferViewDto | null> {
    const caller = callerOf(ctx);
    const offer = await this.writes.admin.get(caller.op, caller.scope, idArgOf(id)).catch(nullWhenNotFound);
    return offer === null ? null : this.viewOf(caller, offer);
  }

  /** Creates a draft (D2431); an unset field takes its default. */
  async create(ctx: RequestContext, input: unknown): Promise<OfferViewDto> {
    const caller = callerOf(ctx);
    const parsed = offerInputSchema.safeParse(offerInputOf(input));
    if (!parsed.success) throw new InvalidOfferConfigError();
    return this.viewOf(caller, await this.writes.admin.createDraft(caller.op, caller.scope, parsed.data));
  }

  /** Edits the offer's fields given in `input`, refused when it changed since `version` was read (D2535). */
  async update(ctx: RequestContext, id: unknown, input: unknown, version?: unknown): Promise<OfferViewDto> {
    const caller = callerOf(ctx);
    const patch = offerPatchOf(input);
    const edit = { patch, expectedVersion: versionOf(version) };
    const updated = await this.writes.admin.edit(caller.op, caller.scope, idArgOf(id), edit);
    return this.viewOf(caller, updated);
  }

  /** Publishes a draft with the publish checks (D2510). */
  publish(ctx: RequestContext, id: unknown): Promise<OfferViewDto> {
    return this.move(ctx, id, 'publish');
  }

  /** Pauses an active offer. */
  pause(ctx: RequestContext, id: unknown): Promise<OfferViewDto> {
    return this.move(ctx, id, 'pause');
  }

  /** Resumes a paused offer with the publish checks (D2510). */
  resume(ctx: RequestContext, id: unknown): Promise<OfferViewDto> {
    return this.move(ctx, id, 'resume');
  }

  /** Archives an offer for good. */
  archive(ctx: RequestContext, id: unknown): Promise<OfferViewDto> {
    return this.move(ctx, id, 'archive');
  }

  /** Copies the offer into a new draft without its codes (D2511). */
  duplicate(ctx: RequestContext, id: unknown): Promise<OfferViewDto> {
    return this.move(ctx, id, 'duplicate');
  }

  /** Deletes a draft (D2521). */
  async delete(ctx: RequestContext, id: unknown): Promise<void> {
    const caller = callerOf(ctx);
    await this.writes.admin.delete(caller.op, caller.scope, idArgOf(id));
  }

  /** The offer's codes, oldest first. */
  async codes(ctx: RequestContext, offerId: unknown): Promise<OfferCodeDto[]> {
    const caller = callerOf(ctx);
    const codes = await this.writes.codes.list(caller.op, caller.scope, idArgOf(offerId));
    return codes.map(toCodeDto);
  }

  /** Adds codes, all or none (D2406, D2449). */
  async addCodes(ctx: RequestContext, offerId: unknown, codes: unknown): Promise<OfferCodeDto[]> {
    const caller = callerOf(ctx);
    if (!Array.isArray(codes)) throw new InvalidOfferConfigError();
    // Each entry is checked by the codes use case's own schema (`parseCodes`), which refuses any other shape.
    const inputs = codes.map((entry: unknown) => withoutNullFields(entry) as CodeInput);
    const stored = await this.writes.codes.add(caller.op, caller.scope, idArgOf(offerId), inputs);
    return stored.map(toCodeDto);
  }

  /** Generates codes (D2512). */
  async generateCodes(ctx: RequestContext, offerId: unknown, input: unknown): Promise<OfferCodeDto[]> {
    const caller = callerOf(ctx);
    const parsed = generateCodesInputSchema.safeParse(withoutNullFields(input));
    if (!parsed.success) throw new InvalidOfferConfigError();
    const stored = await this.writes.codes.generate(caller.op, caller.scope, idArgOf(offerId), parsed.data);
    return stored.map(toCodeDto);
  }

  /** Removes the offer's code; `false` when the offer has no such code. */
  async removeCode(ctx: RequestContext, offerId: unknown, code: unknown): Promise<boolean> {
    const caller = callerOf(ctx);
    const text = typeof code === 'string' ? code : '';
    return this.writes.codes.remove(caller.op, caller.scope, idArgOf(offerId), text);
  }

  /** The offer's performance (D2514); @throws {@link OfferNotFoundError} for an id the store does not hold. */
  async stats(ctx: RequestContext, id: unknown): Promise<OfferPerformance> {
    const caller = callerOf(ctx);
    const offer = await this.writes.admin.get(caller.op, caller.scope, idArgOf(id));
    const performance = await this.reads.stats.performanceOf(caller.op, caller.scope, [offer.id]);
    return { ...(performance.get(offer.id) ?? NO_PERFORMANCE) };
  }

  /** The cards of the create dialog (D2515); a request without a tenant is refused like every other action. */
  appTypes(ctx: RequestContext): Promise<OfferAppType[]> {
    callerOf(ctx);
    return Promise.resolve(this.reads.appTypes.list().map((appType) => ({ ...appType })));
  }

  /** A draft priced on the kind's preview carts, never stored (D2516). */
  preview(ctx: RequestContext, input: unknown): Promise<OfferPreview> {
    const caller = callerOf(ctx);
    const request = { ...asObject(withoutNullFields(input)), offer: offerInputOf(fieldOf(input, 'offer')) };
    // The preview use case parses the whole input with its schema and answers the first issue's code.
    return this.reads.preview.preview(caller.op, caller.scope, request as OfferPreviewInput);
  }

  private async move(ctx: RequestContext, id: unknown, move: LifecycleMove): Promise<OfferViewDto> {
    const caller = callerOf(ctx);
    const moved = await this.writes.lifecycle[move](caller.op, caller.scope, idArgOf(id));
    return this.viewOf(caller, moved);
  }

  private async viewOf(caller: Caller, offer: OfferRecord): Promise<OfferViewDto> {
    const summaries = await this.writes.admin.withCodeCounts(caller.op, caller.scope, [offer]);
    const [view] = await this.viewsOf(caller, summaries);
    if (view === undefined) throw new OfferNotFoundError();
    return view;
  }

  /** The DTOs of `offers` with their performance, read in one call. */
  private async viewsOf(caller: Caller, offers: readonly OfferSummaryRecord[]): Promise<OfferViewDto[]> {
    const ids = offers.map((offer) => offer.id);
    const performance = await this.reads.stats.performanceOf(caller.op, caller.scope, ids);
    return offers.map((offer) => toOfferViewDto(offer, performance.get(offer.id) ?? NO_PERFORMANCE));
  }
}

/** `null` for a not-found refusal, any other error rethrown. */
function nullWhenNotFound(error: unknown): null {
  if (error instanceof OfferNotFoundError) return null;
  throw error;
}

/** `value` when it is an object, else an empty one (the schema then refuses the missing offer). */
const asObject = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
