import type { QuoteRequestInput } from '@cod/shared';
import {
  newBuyerHistoryRegistry,
  newCollectionMembershipRegistry,
  newOfferUsageRegistry,
  newShippingQuoteRegistry,
} from '../../application/default-sources';
import { PricingService } from '../../application/pricing.service';
import { PricingSnapshotLoader } from '../../application/pricing-snapshot.loader';
import { QuoteSigner } from '../../application/quote-signer';
import { UnitPriceRegistry } from '../../application/unit-price.registry';
import { MS_PER_SECOND } from '../../domain/constants';
import { OfferKindRegistry } from '../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../domain/kinds';
import type { OfferRecord } from '../../domain/offer-record';
import type { StoreScope } from '../../domain/store-scope';
import { FakeActiveStores } from '../fakes/fake-active-stores';
import { aGatedVariant, FixedVariantGate } from '../fakes/fixed-variant-gate';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { RecordingPricingLogger } from '../fakes/recording-pricing-logger';
import { T0 } from './builders';
import { aQuoteKeyRing } from './quote-keys';

/** The fixed nonce every test token carries. */
export const FIXED_NONCE = 'AAECAwQFBgcICQoL';

/** Epoch seconds of {@link T0}, the instant the service signs at. */
export const T0_SECONDS = Math.floor(T0.getTime() / MS_PER_SECOND);

/** Variant 11 of product 1 at 4,900 and variant 12 of product 2 at 3,000: what the store's channel sells. */
export const SELLABLE = [aGatedVariant('11', '1', 4_900), aGatedVariant('12', '2', 3_000)];

/** A storefront request for `quantity` pieces of variant 11, home delivery to Algiers. */
export const aRequest = (quantity = 1, overrides: Partial<QuoteRequestInput> = {}): QuoteRequestInput => ({
  channel: 'storefront',
  lines: [{ variantId: '11', quantity }],
  destination: { provinceCode: '16', stopdesk: false },
  ...overrides,
});

/** Product 1 as the only buy target. */
export const PRODUCT_1_TARGET = [{ role: 'buy' as const, refType: 'product' as const, refId: '1' }];

/** The pricing service over in-memory tables, the fixed gate, the default seams, a fixed clock and nonce. */
export function setUpPricing() {
  const tables = new InMemoryOfferTables();
  const stores = new FakeActiveStores();
  const logger = new RecordingPricingLogger();
  const kinds = new OfferKindRegistry(BUILT_IN_OFFER_KINDS);
  const shipping = newShippingQuoteRegistry();
  const usage = newOfferUsageRegistry();
  const buyers = newBuyerHistoryRegistry();
  let now = T0;
  const clock = { now: () => now };
  const loader = new PricingSnapshotLoader({
    offers: tables.offers,
    codes: tables.codes,
    unitPrices: new UnitPriceRegistry(new FixedVariantGate(SELLABLE)),
    collections: newCollectionMembershipRegistry(),
    shipping,
    buyers,
    usage,
    kinds,
    logger,
    clock,
  });
  const signer = new QuoteSigner({ ring: aQuoteKeyRing(['k1'], 'k1'), clock, nonce: () => FIXED_NONCE });
  const service = new PricingService({ stores, loader, signer, kinds });
  const seed = (scope: StoreScope, ...offers: OfferRecord[]) =>
    tables.offerRows.push(...offers.map((value) => ({ ...scope, value })));
  return { service, tables, stores, logger, shipping, usage, buyers, seed, setNow: (instant: Date) => (now = instant) };
}
