import {
  SNOWFLAKE_ID_GENERATOR,
  type SnowflakeIdGeneratorPort,
  TenantRepositoryFactory,
  TenantTransaction,
} from '@cod/plugin-tenancy';
import type { QuoteKeyRing } from '@cod/shared/quote-keys';
import type { Provider } from '@nestjs/common';
import {
  newBuyerHistoryRegistry,
  newCollectionMembershipRegistry,
  newOfferUsageRegistry,
  newOrderAddonTargetRegistry,
  newShippingQuoteRegistry,
} from '../application/default-sources';
import { type OfferAdminPorts, OfferAdminService } from '../application/offer-admin.service';
import { type OfferCodesPorts, OfferCodesService } from '../application/offer-codes.service';
import { type OfferLifecyclePorts, OfferLifecycleService } from '../application/offer-lifecycle.service';
import { type OfferUsagePorts, OfferUsageService } from '../application/offer-usage.service';
import { OrderAddonService } from '../application/order-addon.service';
import { PricingService } from '../application/pricing.service';
import { PricingSnapshotLoader, type PricingSnapshotPorts } from '../application/pricing-snapshot.loader';
import { QuoteSigner, randomQuoteNonce } from '../application/quote-signer';
import {
  ACTIVE_STORE,
  BUYER_HISTORY,
  BUYER_HISTORY_REGISTRAR,
  CLOCK,
  COLLECTION_MEMBERSHIP,
  COLLECTION_MEMBERSHIP_REGISTRAR,
  ID_GENERATOR,
  OFFER_CODE_REPOSITORY,
  OFFER_EVENTS,
  OFFER_KIND_REGISTRY,
  OFFER_REPOSITORY,
  OFFER_USAGE,
  OFFER_USAGE_COUNTER,
  OFFER_USAGE_REGISTRAR,
  ORDER_ADDON_TARGET,
  ORDER_ADDON_TARGET_REGISTRAR,
  PRICING_LOGGER,
  PRICING_SNAPSHOT_SOURCE,
  PRODUCT_VARIANTS,
  QUOTE_KEY_RING,
  RANDOM_CODE_SOURCE,
  SHIPPING_QUOTE,
  SHIPPING_QUOTE_REGISTRAR,
  UNIT_PRICE_RESOLVER,
  UNIT_PRICE_RESOLVER_REGISTRAR,
  VARIANT_GATE,
} from '../application/tokens';
import { UnitPriceRegistry } from '../application/unit-price.registry';
import { OfferKindRegistry } from '../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../domain/kinds';
import type { ActiveStorePort } from '../domain/ports/active-store.port';
import type { OfferEventsPort } from '../domain/ports/offer-events.port';
import type { OrderAddonTarget } from '../domain/ports/order-addon-target.port';
import type { Clock } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { PricingLogger } from '../domain/ports/pricing-logger.port';
import type { PricingSnapshotSource } from '../domain/ports/pricing-snapshot-source.port';
import type { VariantGate } from '../domain/ports/variant-gate.port';
import type { SourceHolder } from '../application/single-source.registry';
import { CryptoCodeSource } from './crypto-code-source';
import { OutboxOfferEvents } from './offer-applied.outbox';
import { SnowflakeOfferIdGenerator } from './snowflake-id.generator';
import { SYSTEM_CLOCK } from './system-clock';
import { TenancyActiveStore } from './tenancy-active-store.adapter';
import { TypeOrmOfferCodeRepository } from './typeorm-offer-code.repository';
import { TypeOrmOfferRepository } from './typeorm-offer.repository';
import { TypeOrmOfferUsageCounter } from './typeorm-offer-usage.counter';
import { VendureProductVariants } from './vendure-product-variants';
import { VendureVariantGate } from './variant-gate';
import { VENDURE_PRICING_LOGGER } from './vendure-pricing.logger';

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
  ORDER_ADDON_TARGET_REGISTRAR,
] as const;

/** The use cases other plugins, tests and the evidence script inject by class (D2408, D2431, D2447, D2510). */
export const OFFERS_USE_CASES = [
  PricingService,
  OfferAdminService,
  OfferLifecycleService,
  OfferCodesService,
  OfferUsageService,
  OrderAddonService,
] as const;

/** The seams (D2423, D2508): the variant gate, the unit-price chain and the five one-source registries. */
const SEAM_PROVIDERS: Provider[] = [
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
  ...seam(ORDER_ADDON_TARGET, ORDER_ADDON_TARGET_REGISTRAR, newOrderAddonTargetRegistry),
];

/**
 * The adapters behind the offers' ports: repositories, ids, clock, logger, kinds, events, the active store, the random
 * source of generated codes and the product variants.
 */
const PORT_PROVIDERS: Provider[] = [
  { provide: OFFER_EVENTS, useClass: OutboxOfferEvents },
  { provide: RANDOM_CODE_SOURCE, useClass: CryptoCodeSource },
  { provide: PRODUCT_VARIANTS, useClass: VendureProductVariants },
  { provide: CLOCK, useValue: SYSTEM_CLOCK },
  { provide: PRICING_LOGGER, useValue: VENDURE_PRICING_LOGGER },
  { provide: OFFER_KIND_REGISTRY, useFactory: () => new OfferKindRegistry(BUILT_IN_OFFER_KINDS) },
  { provide: ACTIVE_STORE, useClass: TenancyActiveStore },
  {
    provide: ID_GENERATOR,
    useFactory: (ids: SnowflakeIdGeneratorPort) => new SnowflakeOfferIdGenerator(ids),
    inject: [SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: OFFER_REPOSITORY,
    useFactory: (
      repositories: TenantRepositoryFactory,
      transaction: TenantTransaction,
      ids: IdGeneratorPort,
      logger: PricingLogger,
    ) => new TypeOrmOfferRepository({ repositories, transaction, ids, logger }),
    inject: [TenantRepositoryFactory, TenantTransaction, ID_GENERATOR, PRICING_LOGGER],
  },
  {
    provide: OFFER_CODE_REPOSITORY,
    useFactory: (repositories: TenantRepositoryFactory, transaction: TenantTransaction) =>
      new TypeOrmOfferCodeRepository(repositories, transaction),
    inject: [TenantRepositoryFactory, TenantTransaction],
  },
  {
    provide: OFFER_USAGE_COUNTER,
    useFactory: (repositories: TenantRepositoryFactory) => new TypeOrmOfferUsageCounter(repositories),
    inject: [TenantRepositoryFactory],
  },
];

/**
 * A use case built from a port bundle whose keys are paired with their tokens by name, never by position: a key
 * missing from `tokens` fails typecheck.
 */
function fromPorts<Ports extends object>(
  type: new (ports: Ports) => object,
  tokens: Readonly<Record<keyof Ports, symbol>>,
): Provider {
  const keys = Object.keys(tokens) as (keyof Ports)[];
  return {
    provide: type,
    useFactory: (...values: unknown[]) =>
      new type(Object.fromEntries(keys.map((key, index) => [key, values[index]])) as Ports),
    inject: keys.map((key) => tokens[key]),
  };
}

const SNAPSHOT_PORT_TOKENS = {
  offers: OFFER_REPOSITORY,
  codes: OFFER_CODE_REPOSITORY,
  unitPrices: UNIT_PRICE_RESOLVER,
  collections: COLLECTION_MEMBERSHIP,
  shipping: SHIPPING_QUOTE,
  buyers: BUYER_HISTORY,
  usage: OFFER_USAGE,
  kinds: OFFER_KIND_REGISTRY,
  logger: PRICING_LOGGER,
  clock: CLOCK,
} as const satisfies Record<keyof PricingSnapshotPorts, symbol>;

const OFFER_LIFECYCLE_PORT_TOKENS = {
  offers: OFFER_REPOSITORY,
  ids: ID_GENERATOR,
  clock: CLOCK,
  kinds: OFFER_KIND_REGISTRY,
  stores: ACTIVE_STORE,
} as const satisfies Record<keyof OfferLifecyclePorts, symbol>;

const OFFER_CODES_PORT_TOKENS = {
  offers: OFFER_REPOSITORY,
  codes: OFFER_CODE_REPOSITORY,
  ids: ID_GENERATOR,
  clock: CLOCK,
  stores: ACTIVE_STORE,
  random: RANDOM_CODE_SOURCE,
} as const satisfies Record<keyof OfferCodesPorts, symbol>;

const OFFER_ADMIN_PORT_TOKENS = {
  ...OFFER_LIFECYCLE_PORT_TOKENS,
  ...OFFER_CODES_PORT_TOKENS,
  variants: PRODUCT_VARIANTS,
} as const satisfies Record<keyof OfferAdminPorts, symbol>;

const OFFER_USAGE_PORT_TOKENS = {
  counter: OFFER_USAGE_COUNTER,
  stores: ACTIVE_STORE,
} as const satisfies Record<keyof OfferUsagePorts, symbol>;

/**
 * The use cases: the snapshot loader behind `PRICING_SNAPSHOT_SOURCE` (D2424; P3.S3 rebinds the token to a cache
 * wrapping the loader), the quote signer, the pricing service, the offer admin, lifecycle, codes and usage (D2408,
 * D2431, D2447, D2510, D2512) and the post-order add-on (D2508).
 */
const USE_CASE_PROVIDERS: Provider[] = [
  fromPorts(PricingSnapshotLoader, SNAPSHOT_PORT_TOKENS),
  { provide: PRICING_SNAPSHOT_SOURCE, useExisting: PricingSnapshotLoader },
  {
    provide: QuoteSigner,
    useFactory: (ring: QuoteKeyRing, clock: Clock) => new QuoteSigner({ ring, clock, nonce: randomQuoteNonce }),
    inject: [QUOTE_KEY_RING, CLOCK],
  },
  {
    provide: PricingService,
    useFactory: (
      stores: ActiveStorePort,
      snapshots: PricingSnapshotSource,
      signer: QuoteSigner,
      kinds: OfferKindRegistry,
    ) => new PricingService({ stores, snapshots, signer, kinds }),
    inject: [ACTIVE_STORE, PRICING_SNAPSHOT_SOURCE, QuoteSigner, OFFER_KIND_REGISTRY],
  },
  fromPorts(OfferAdminService, OFFER_ADMIN_PORT_TOKENS),
  fromPorts(OfferLifecycleService, OFFER_LIFECYCLE_PORT_TOKENS),
  fromPorts(OfferCodesService, OFFER_CODES_PORT_TOKENS),
  fromPorts(OfferUsageService, OFFER_USAGE_PORT_TOKENS),
  {
    provide: OrderAddonService,
    useFactory: (
      stores: ActiveStorePort,
      orders: SourceHolder<OrderAddonTarget>,
      pricing: PricingService,
      events: OfferEventsPort,
    ) => new OrderAddonService({ stores, orders, pricing, events }),
    inject: [ACTIVE_STORE, ORDER_ADDON_TARGET, PricingService, OFFER_EVENTS],
  },
];

/** Wires the offers: seams, port adapters and use cases. */
export const OFFERS_PROVIDERS: Provider[] = [...SEAM_PROVIDERS, ...PORT_PROVIDERS, ...USE_CASE_PROVIDERS];
