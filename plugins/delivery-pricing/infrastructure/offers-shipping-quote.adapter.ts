import {
  type OperationContext as OffersOperationContext,
  SHIPPING_QUOTE_REGISTRAR,
  type ShippingQuoteInput,
  type ShippingQuoteRegistrar,
  type ShippingQuoteResult,
  type ShippingQuoteSource,
  type StoreScope as OffersStoreScope,
} from '@cod/plugin-offers';
import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ShippingQuoteService } from '../application/shipping-quote.service';
import { asOperationContext } from '../domain/ports/operation-context';
import { townOnsOf } from '../domain/town-ons';

/** The offers' unresolved delivery: fees 0, no speed (D2423). */
const UNRESOLVED: ShippingQuoteResult = { resolved: false, baseFee: 0, overweightFee: 0, speed: null };

/**
 * The store's fee table on the offers' `SHIPPING_QUOTE_REGISTRAR` (D2423), registered on bootstrap (the plugin comes
 * after `OffersPlugin`). It answers unwaived: the offer engine applies free delivery itself (D2414). The destination's
 * `townOns` text is read only when it is an ONS code; any other value answers unresolved, so a bad commune never
 * falls back to the wilaya price (D3125).
 */
@Injectable()
export class OffersShippingQuoteAdapter implements ShippingQuoteSource, OnApplicationBootstrap {
  constructor(
    private readonly quotes: ShippingQuoteService,
    @Inject(SHIPPING_QUOTE_REGISTRAR) private readonly registrar: ShippingQuoteRegistrar,
  ) {}

  onApplicationBootstrap(): void {
    this.registrar.register(this);
  }

  async quote(
    ctx: OffersOperationContext,
    scope: OffersStoreScope,
    input: ShippingQuoteInput,
  ): Promise<ShippingQuoteResult> {
    const town = townOnsOf(input.townOns);
    if (!town.ok) return UNRESOLVED;
    const quote = await this.quotes.quote(asOperationContext(ctx), scope, {
      provinceCode: input.provinceCode,
      ...(town.codeOns === undefined ? {} : { townOns: town.codeOns }),
      stopdesk: input.stopdesk,
      items: input.items.map(({ productId, quantity, weightGrams }) => ({
        productId,
        quantity,
        ...(weightGrams === undefined ? {} : { weightGrams }),
      })),
    });
    const { resolved, baseFee, overweightFee, speed } = quote;
    return { resolved, baseFee, overweightFee, speed };
  }
}
