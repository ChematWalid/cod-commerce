import {
  type OfferPreview,
  type OfferPreviewCommand,
  type OfferPreviewInput,
  offerPreviewInputSchema,
  PRICING_ERROR_CODES,
  type PreviewQuote,
  type PreviewScenario,
} from '@cod/shared';
import { PREVIEW_ADDON_PLACEMENT } from '../domain/constants';
import { DEFAULT_PREVIEW_CARTS, type OfferKindRegistry, type PreviewCart } from '../domain/engine/kind-registry';
import { priceCart } from '../domain/engine/pipeline';
import type { PricedQuote } from '../domain/engine/priced-quote';
import { type PreviewDraft, type PreviewSample, previewSnapshot } from '../domain/engine/preview-snapshot';
import { InvalidOfferConfigError, InvalidQuoteRequestError, UnknownOfferKindError } from '../domain/errors';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { Clock } from '../domain/ports/clock.port';
import type { OperationContext } from '../domain/ports/operation-context.port';
import type { StoreScope } from '../domain/store-scope';
import { assertOnChannelOf } from './store-channel';

/** What the preview use case reaches: no repository, so a preview never reads or writes a row (D2516). */
export interface OfferPreviewPorts {
  /** Checks every call's `ctx` is on `scope`'s store channel (D2448). */
  readonly stores: ActiveStorePort;
  readonly kinds: OfferKindRegistry;
  readonly clock: Clock;
}

/**
 * `input` validated: a refused offer field or kind field answers `offers.invalid-config`, a refused sample
 * `pricing.invalid-request`, as the first issue's code says.
 */
function parsePreview(input: OfferPreviewInput): OfferPreviewCommand {
  const parsed = offerPreviewInputSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const [issue] = parsed.error.issues;
  if (issue?.message === PRICING_ERROR_CODES.INVALID_CONFIG) throw new InvalidOfferConfigError();
  throw new InvalidQuoteRequestError();
}

/** The quote parts a preview shows (D2516). */
function previewQuoteOf(priced: PricedQuote): PreviewQuote {
  const { lines, subtotal, discountTotal, delivery, total, savings, nudge, suggestions } = priced;
  return { lines, subtotal, discountTotal, delivery, total, savings, nudge, suggestions };
}

/**
 * Prices an unsaved offer the way the order form would (D2516, ADR 0017): the kind's preview carts priced by the pure
 * engine on an in-memory snapshot holding only the draft, at a sample unit price and delivery fee, with the kind's
 * configuration warnings. No repository is read or written.
 */
export class OfferPreviewService {
  constructor(private readonly ports: OfferPreviewPorts) {}

  /**
   * The draft of `input` priced on each preview cart of its kind.
   *
   * @throws {@link InvalidOfferConfigError} when the offer or its kind configuration breaks its schema.
   * @throws {@link UnknownOfferKindError} when no calculator handles the kind.
   * @throws {@link InvalidQuoteRequestError} when the sample price or fee is out of range.
   * @throws {@link NoActiveStoreError} when `ctx` is not on `scope`'s store channel.
   * @throws {@link PricingTotalTooLargeError} when a scenario's total leaves the money range.
   */
  async preview(ctx: OperationContext, scope: StoreScope, input: OfferPreviewInput): Promise<OfferPreview> {
    const { offer: command, samplePrice, sampleDeliveryFee } = parsePreview(input);
    await assertOnChannelOf(this.ports.stores, ctx, scope);
    const { kinds } = this.ports;
    const config = kinds.parseConfig(command.kind, command.config);
    const calculator = kinds.get(command.kind);
    if (calculator === undefined) throw new UnknownOfferKindError();
    const draft: PreviewDraft = {
      command,
      addonPlacement: calculator.addonPlacement?.(config) ?? PREVIEW_ADDON_PLACEMENT,
    };
    const sample: PreviewSample = { price: samplePrice, deliveryFee: sampleDeliveryFee, now: this.ports.clock.now() };
    const carts = calculator.previewCarts?.(config) ?? DEFAULT_PREVIEW_CARTS;
    return {
      scenarios: carts.map((cart) => this.scenarioOf(draft, cart, sample)),
      warnings: [...(calculator.configWarnings?.(config) ?? [])],
    };
  }

  private scenarioOf(draft: PreviewDraft, cart: PreviewCart, sample: PreviewSample): PreviewScenario {
    const priced = priceCart({ registry: this.ports.kinds, ...previewSnapshot(draft, cart, sample) });
    return { pieces: cart.pieces, addonAccepted: cart.withAddon, quote: previewQuoteOf(priced) };
  }
}
