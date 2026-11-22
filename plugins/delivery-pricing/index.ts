// The public entry of delivery-pricing (D3118, rule `delivery-pricing-entry-infra-only`): another plugin imports it
// only from its infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does.
export { DeliveryPricingPlugin } from './delivery-pricing.plugin';

// The store's seeded "Platform default prices" table: the lifecycle hook and the migrate converge call it (D3112).
export { DefaultTableService } from './application/default-table.service';

// Links every active store to its default table on migrate (D3112); the migrate role calls it with a platform context.
export {
  type DeliveryDefaultsConvergeReport,
  DeliveryDefaultsConvergeService,
} from './application/delivery-defaults-converge.service';
export { type DeliveryDefaultsConvergeFailure, DeliveryDefaultsConvergeFailedError } from './domain/errors';
export { asOperationContext } from './domain/ports/operation-context';

// The store's delivery quote (D3125): the storefront checkout (P3.S3) and the order form (P4.S3) inject it by class.
export { ShippingQuoteService } from './application/shipping-quote.service';
export type { ShippingQuoteItem, ShippingQuoteRequest } from './domain/quote-request';
export type { StoreScope as DeliveryStoreScope } from './domain/store-scope';
