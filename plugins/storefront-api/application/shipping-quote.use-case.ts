import { type ShippingQuote, storefrontShippingQuoteBodySchema } from '@cod/shared';
import type { DeliveryQuotePort } from '../domain/ports/delivery-quote.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StorefrontStorePort } from '../domain/ports/storefront-store.port';
import { parsedQuoteBody } from './quote-body';

/** What the shipping quote reads through. */
export interface ShippingQuotePorts {
  readonly stores: StorefrontStorePort;
  readonly delivery: DeliveryQuotePort;
}

/**
 * `POST /store/shipping-quote` (D3301): the delivery fee of a body for the signed store. It prices nothing itself: the
 * store comes from the context, never the body, and the delivery port answers the fee without any waiver.
 */
export class ShippingQuoteUseCase {
  constructor(private readonly ports: ShippingQuotePorts) {}

  /** The delivery quote of `raw` for the context's store; a refused body throws `QuoteRequestInvalidError`. */
  async quote(ctx: OperationContext, raw: unknown): Promise<ShippingQuote> {
    const { scope } = this.ports.stores.storeOf(ctx);
    const body = parsedQuoteBody(storefrontShippingQuoteBodySchema, raw);
    return this.ports.delivery.quote(ctx, scope, body);
  }
}
