import type { DeliveryBlock } from '@cod/shared';
import { deliveryMethodOf, type PricingDestination } from '../cart';
import type { ShippingQuoteResult } from '../snapshot';
import type { DeliveryContext } from './outcome';

/** What delivery costs before any waiver: base plus overweight once resolved, nothing before (D2414, D2423). */
export function deliveryFeeOf(shipping: ShippingQuoteResult): number {
  return shipping.resolved ? shipping.baseFee + shipping.overweightFee : 0;
}

/** The shipping quote with the method the destination asks for, as kind calculators read it. */
export function deliveryContextOf(shipping: ShippingQuoteResult, destination: PricingDestination): DeliveryContext {
  return { ...shipping, method: deliveryMethodOf(destination) };
}

/**
 * The delivery block of a quote (D2414): a waiver takes off the base fee and the overweight fee, so the price is 0;
 * an unresolved delivery costs 0 until the fee table answers.
 */
export function deliveryBlock(shipping: ShippingQuoteResult, waived: boolean): DeliveryBlock {
  return {
    resolved: shipping.resolved,
    fee: shipping.baseFee,
    overweightFee: shipping.overweightFee,
    waived,
    price: waived ? 0 : deliveryFeeOf(shipping),
    freeShipping: waived,
    speed: shipping.speed,
  };
}
