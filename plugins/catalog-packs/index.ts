// The public entry of catalog-packs (D2200, rule `catalog-packs-entry-infra-only`): another plugin imports it only
// from its infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does.
export { CatalogPacksPlugin } from './catalog-packs.plugin';
export { PackUnitPriceResolver } from './infrastructure/pack-unit-price.resolver';
export type {
  PackPriceResolverShape,
  PackUnitPrice,
  PriceLine as PackPriceLine,
} from './domain/ports/pack-price-resolver-shape.port';
export { packPrice, type PricedComponent } from './domain/pack-price';
export { packWeight, type WeighedComponent } from './domain/pack-weight';
export { sharedOptionMatrix, type ComponentOptions, type SharedMatrix } from './domain/shared-option';
export type { PackComponentLine, PackDefinition, PackPricing, PackStatus, PackWeighting } from './domain/pack';
