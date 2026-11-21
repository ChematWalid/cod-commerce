// The public entry of catalog-packs (D2200, rule `catalog-packs-entry-infra-only`): another plugin imports it only
// from its infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does.
export { CatalogPacksPlugin } from './catalog-packs.plugin';
export { PackUnitPriceResolver } from './infrastructure/pack-unit-price.resolver';
export type { PackUnitPrice, PriceLine as PackPriceLine } from './domain/ports/pack-price-resolver-shape.port';
export { packPrice, type PricedComponent } from './domain/pack-price';
export { packWeight, type WeighedComponent } from './domain/pack-weight';
export { sharedOptionMatrix, type ComponentOptions, type SharedMatrix } from './domain/shared-option';
export type { PackComponentLine, PackDefinition, PackPricing, PackStatus, PackWeighting } from './domain/pack';
export {
  expandPackLine,
  type ComponentVariantPrice,
  type ExpandablePack,
  type ExpandedPackChild,
  type ExpandedPackParent,
  type PackLine,
  type PackLineExpansion,
  type PackLineExpansionInput,
} from './domain/expand-pack-line';
// The block's test ids, for the browser spec and the evidence script (framework-free, `dashboard-shared-is-pure`).
export {
  PACK_BLOCK_TEST_ID,
  PACK_COMPONENT_ROW_TEST_ID,
  PACK_DISCOUNT_VALUE_TEST_ID,
  PACK_PICKER_OPTION_TEST_ID,
  PACK_PICKER_SEARCH_TEST_ID,
  PACK_PREVIEW_TEST_ID,
  PACK_PRICE_TEST_ID,
  PACK_SAVE_FIRST_TEST_ID,
  PACK_SAVE_TEST_ID,
} from './dashboard/constants';
