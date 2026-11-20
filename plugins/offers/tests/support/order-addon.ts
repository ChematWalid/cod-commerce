import { quoteRequestSchema, toSnowflake } from '@cod/shared';
import { newOrderAddonTargetRegistry } from '../../application/default-sources';
import { OrderAddonService } from '../../application/order-addon.service';
import type { ScopedQuoteOptions } from '../../application/pricing.service';
import type { OfferRecord } from '../../domain/offer-record';
import type { AddonOrder } from '../../domain/ports/order-addon-target.port';
import { FakeOrderAddonTarget } from '../fakes/fake-order-addon-target';
import { RecordingOfferEvents } from '../fakes/recording-offer-events';
import { anAddonConfig } from './addon';
import { anActiveOffer } from './offer-records';
import { aRequest, setUpPricing } from './pricing-service';

/** The id of the order of these tests. */
export const ORDER_ID = toSnowflake('1400000000000000001');

/** A pending order of one piece of variant 11, changed by `overrides`. */
export const anAddonOrder = (overrides: Partial<AddonOrder> = {}): AddonOrder => ({
  id: ORDER_ID,
  status: 'pending',
  cart: quoteRequestSchema.parse(aRequest(1)),
  ...overrides,
});

/** An active thank-you add-on offer of variant 12 (product 2, listed 3,000) at a fixed 1,500, changed by `raw`. */
export const aThankYouAddon = (raw: Record<string, unknown> = {}): OfferRecord =>
  anActiveOffer({
    kind: 'addon',
    config: anAddonConfig({ price: { mode: 'fixed', value: 1_500 }, placement: 'thank_you', ...raw }),
    targets: [{ role: 'addon', refType: 'variant', refId: '12' }],
  });

/**
 * The post-order add-on use case over the pricing test world, a fake order source registered on its registry and
 * recorded events; `quoteOptions` lists the options of every quote it asked for.
 */
export function setUpOrderAddons({ registerTarget = true } = {}) {
  const pricing = setUpPricing();
  const target = new FakeOrderAddonTarget();
  const orders = newOrderAddonTargetRegistry();
  if (registerTarget) orders.register(target);
  const events = new RecordingOfferEvents();
  const quoteOptions: ScopedQuoteOptions[] = [];
  const quoter: ConstructorParameters<typeof OrderAddonService>[0]['pricing'] = {
    quoteForScope: (ctx, scope, request, options) => {
      if (options !== undefined) quoteOptions.push(options);
      return pricing.service.quoteForScope(ctx, scope, request, options);
    },
  };
  const service = new OrderAddonService({ stores: pricing.stores, orders, pricing: quoter, events });
  return { ...pricing, addons: service, target, events, quoteOptions };
}
