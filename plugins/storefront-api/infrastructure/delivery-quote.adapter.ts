import {
  asOperationContext as asDeliveryContext,
  type ShippingQuoteRequest,
  ShippingQuoteService,
} from '@cod/plugin-delivery-pricing';
import type { ShippingQuote, StorefrontShippingQuoteBody, WilayaCode } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { DeliveryQuotePort } from '../domain/ports/delivery-quote.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { StoreScope } from '../domain/store-scope';

/**
 * The delivery-pricing request of a parsed body. Built field by field, so nothing else the body held reaches the
 * service, and `waive` is never set (D3301). The wilaya code passes as sent: which codes exist is the delivery
 * service's (geo data) answer, which quotes an unknown one unresolved. The commune code text becomes its number.
 */
export function deliveryRequestOf(body: StorefrontShippingQuoteBody): ShippingQuoteRequest {
  const items = body.items.map(({ productId, quantity }) => ({ productId, quantity }));
  const request = { provinceCode: body.provinceCode as WilayaCode, stopdesk: body.stopdesk, items };
  return body.townOns === undefined ? request : { ...request, townOns: Number(body.townOns) };
}

/** {@link DeliveryQuotePort} over P3.S1's `ShippingQuoteService` (D3301). */
@Injectable()
export class DeliveryPricingQuoteAdapter implements DeliveryQuotePort {
  constructor(private readonly quotes: ShippingQuoteService) {}

  quote(ctx: OperationContext, scope: StoreScope, body: StorefrontShippingQuoteBody): Promise<ShippingQuote> {
    return this.quotes.quote(asDeliveryContext(ctx), scope, deliveryRequestOf(body));
  }
}
