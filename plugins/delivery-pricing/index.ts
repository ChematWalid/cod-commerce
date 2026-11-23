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

// The dashboard's route paths and test ids, for the browser spec and the evidence script (framework-free).
export {
  ADD_PRICING_TEST_ID,
  APPLY_ALL_TEST_ID,
  APPLY_DESK_TEST_ID,
  APPLY_HOME_TEST_ID,
  CARRIERS_PLACEHOLDER_TEST_ID,
  COMMUNE_PANEL_TEST_ID,
  COMMUNE_ROW_TEST_ID,
  COMMUNES_SAVE_FIRST_TEST_ID,
  DELIVER_EVERYWHERE_TEST_ID,
  DELIVERY_PAGE_TEST_ID,
  DELIVERY_PATH,
  DELIVERY_TABS_TEST_ID,
  DESK_EVERYWHERE_TEST_ID,
  NEW_PRICING_PATH,
  PRICING_BACK_TEST_ID,
  PRICING_EDITOR_TEST_ID,
  PRICING_EMPTY_TEST_ID,
  PRICING_LIST_TEST_ID,
  PRICING_NAME_TEST_ID,
  PRICING_ROW_TEST_ID,
  PRICING_SAVE_TEST_ID,
  pricingPathOf,
  WILAYA_ROW_TEST_ID,
} from './dashboard/constants';
