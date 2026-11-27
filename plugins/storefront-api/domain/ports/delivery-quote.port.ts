import type { ShippingQuote, StorefrontShippingQuoteBody } from '@cod/shared';
import type { StoreScope } from '../store-scope';
import type { OperationContext } from './operation-context';

/**
 * The store's delivery quote (D3301): the fee of a parsed shipping-quote body in the signed store `scope`. The adapter
 * never waives the fee: a buyer's body cannot price their own delivery at 0.
 */
export interface DeliveryQuotePort {
  quote(ctx: OperationContext, scope: StoreScope, body: StorefrontShippingQuoteBody): Promise<ShippingQuote>;
}
