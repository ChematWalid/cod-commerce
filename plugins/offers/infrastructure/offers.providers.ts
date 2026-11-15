import type { Provider } from '@nestjs/common';
import {
  newBuyerHistoryRegistry,
  newCollectionMembershipRegistry,
  newOfferUsageRegistry,
  newShippingQuoteRegistry,
} from '../application/default-sources';
import {
  BUYER_HISTORY,
  BUYER_HISTORY_REGISTRAR,
  COLLECTION_MEMBERSHIP,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  OFFER_USAGE,
  OFFER_USAGE_REGISTRAR,
  SHIPPING_QUOTE,
  SHIPPING_QUOTE_REGISTRAR,
  UNIT_PRICE_RESOLVER,
  UNIT_PRICE_RESOLVER_REGISTRAR,
  VARIANT_GATE,
} from '../application/tokens';
import { UnitPriceRegistry } from '../application/unit-price.registry';
import type { VariantGate } from '../domain/ports/variant-gate.port';
import { VendureVariantGate } from './variant-gate';

/** A seam whose registry is read under `token` and registered on under `registrar`: one instance behind both. */
const seam = (token: symbol, registrar: symbol, make: () => object): Provider[] => [
  { provide: token, useFactory: make },
  { provide: registrar, useExisting: token },
];

/** The registrar tokens other plugins inject (exported by `OffersPlugin`). */
export const OFFERS_REGISTRARS = [
  UNIT_PRICE_RESOLVER_REGISTRAR,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  SHIPPING_QUOTE_REGISTRAR,
  BUYER_HISTORY_REGISTRAR,
  OFFER_USAGE_REGISTRAR,
] as const;

/** Wires the offers' seams (D2423): the variant gate, the unit-price chain and the four one-source registries. */
export const OFFERS_PROVIDERS: Provider[] = [
  VendureVariantGate,
  { provide: VARIANT_GATE, useExisting: VendureVariantGate },
  {
    provide: UNIT_PRICE_RESOLVER,
    useFactory: (gate: VariantGate) => new UnitPriceRegistry(gate),
    inject: [VARIANT_GATE],
  },
  { provide: UNIT_PRICE_RESOLVER_REGISTRAR, useExisting: UNIT_PRICE_RESOLVER },
  ...seam(COLLECTION_MEMBERSHIP, COLLECTION_MEMBERSHIP_REGISTRAR, newCollectionMembershipRegistry),
  ...seam(SHIPPING_QUOTE, SHIPPING_QUOTE_REGISTRAR, newShippingQuoteRegistry),
  ...seam(BUYER_HISTORY, BUYER_HISTORY_REGISTRAR, newBuyerHistoryRegistry),
  ...seam(OFFER_USAGE, OFFER_USAGE_REGISTRAR, newOfferUsageRegistry),
];
