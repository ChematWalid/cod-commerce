import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import type { ProductPorts } from '../application/catalog-ports';
import { BrandService } from '../application/brand.service';
import { CreateProductService } from '../application/create-product.service';
import { DemoCatalogSeedService } from '../application/demo-catalog-seed.service';
import { DeleteProductService } from '../application/delete-product.service';
import { GetProductService } from '../application/get-product.service';
import { HighlightService } from '../application/highlight.service';
import { ListProductsService } from '../application/list-products.service';
import { MediaLibraryService } from '../application/media-library.service';
import { OrderManagerCheckRegistry } from '../application/order-manager-check.registry';
import { SetProductStatusService } from '../application/set-product-status.service';
import { SlugAvailabilityService } from '../application/slug-availability.service';
import { TagService } from '../application/tag.service';
import {
  BRAND_REPOSITORY,
  CLOCK,
  DESCRIPTION_SANITIZER,
  HIGHLIGHT_REPOSITORY,
  ID_GENERATOR,
  MEDIA_LOCK,
  MEDIA_REPOSITORY,
  MEDIA_STORAGE,
  ORDER_MANAGER_CHECK_REGISTRAR,
  PRODUCT_CATALOG,
  PRODUCT_COLLECTION_REPOSITORY,
  PRODUCT_EVENTS,
  PRODUCT_PORTS,
  PRODUCT_SEARCH,
  PRODUCT_SETTINGS_REPOSITORY,
  SOLD_OUT_SOURCE,
  STORE_SETTINGS,
  TAG_REPOSITORY,
  TAXONOMY_LOCK,
  TRANSACTION,
} from '../application/tokens';
import { CatalogReadService } from '../application/catalog-read.service';
import { SoldOutService } from '../application/sold-out.service';
import { UpdateProductService } from '../application/update-product.service';
import type { ClockPort } from '../domain/ports/clock.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { ProductSettingsRepositoryPort } from '../domain/ports/product-settings-repository.port';
import { HtmlDescriptionSanitizer } from './description-sanitizer';
import { OutboxProductEvents } from './product-changed.outbox';
import { SettingsFlagSoldOutSource } from './settings-flag-sold-out.source';
import { SnowflakeCatalogIdGenerator } from './snowflake-id.generator';
import { TenancyStoreSettings } from './tenancy-store-settings.adapter';
import { TransactionAdapter } from './transaction.adapter';
import { TypeOrmBrandRepository } from './typeorm-brand.repository';
import { TypeOrmHighlightRepository } from './typeorm-highlight.repository';
import { TypeOrmMediaRepository } from './typeorm-media.repository';
import { TypeOrmProductCollectionRepository } from './typeorm-product-collection.repository';
import { TypeOrmProductSettingsRepository } from './typeorm-product-settings.repository';
import { TypeOrmTagRepository } from './typeorm-tag.repository';
import { PgProductLock } from './pg-product-lock';
import { PgMediaLock } from './pg-media-lock';
import { PgTaxonomyLock } from './pg-taxonomy-lock';
import { VendureAssetReads } from './vendure-asset-reads';
import { DefaultChannelExit } from './vendure-default-channel';
import { VendureMediaStorage } from './vendure-media-storage.adapter';
import { VendureOptionSync } from './vendure-option-sync';
import { VendureProductCatalog } from './vendure-product-catalog.adapter';
import { VendureProductStructure } from './vendure-product-structure';
import { VendureProductSearch } from './vendure-product-search.adapter';
import { VendureVariantSync } from './vendure-variant-sync.adapter';

const SYSTEM_CLOCK: ClockPort = { now: () => new Date() };

/** The order of the injected adapters, which the bundle factory receives. */
const PORT_TOKENS = [
  PRODUCT_CATALOG,
  PRODUCT_SEARCH,
  PRODUCT_EVENTS,
  TRANSACTION,
  BRAND_REPOSITORY,
  TAG_REPOSITORY,
  HIGHLIGHT_REPOSITORY,
  PRODUCT_SETTINGS_REPOSITORY,
  MEDIA_REPOSITORY,
  MEDIA_STORAGE,
  PRODUCT_COLLECTION_REPOSITORY,
  DESCRIPTION_SANITIZER,
  ID_GENERATOR,
  CLOCK,
  TAXONOMY_LOCK,
  MEDIA_LOCK,
  ORDER_MANAGER_CHECK_REGISTRAR,
  SOLD_OUT_SOURCE,
  STORE_SETTINGS,
] as const;

const PORT_KEYS = [
  'products',
  'search',
  'events',
  'transaction',
  'brands',
  'tags',
  'highlights',
  'settings',
  'media',
  'storage',
  'collections',
  'sanitizer',
  'ids',
  'clock',
  'taxonomyLock',
  'mediaLock',
  'orderManagers',
  'soldOut',
  'stores',
] as const satisfies readonly (keyof ProductPorts)[];

/** A use case built from the port bundle. */
const useCase = (type: new (ports: ProductPorts) => object): Provider => ({
  provide: type,
  useFactory: (ports: ProductPorts) => new type(ports),
  inject: [PRODUCT_PORTS],
});

/** Wires the product, taxonomy and media library use cases to their adapters. */
export const PRODUCT_PROVIDERS: Provider[] = [
  VendureOptionSync,
  VendureVariantSync,
  DefaultChannelExit,
  PgProductLock,
  VendureProductStructure,
  { provide: PRODUCT_CATALOG, useClass: VendureProductCatalog },
  { provide: PRODUCT_SEARCH, useClass: VendureProductSearch },
  { provide: PRODUCT_EVENTS, useClass: OutboxProductEvents },
  { provide: TRANSACTION, useClass: TransactionAdapter },
  { provide: BRAND_REPOSITORY, useClass: TypeOrmBrandRepository },
  { provide: PRODUCT_SETTINGS_REPOSITORY, useClass: TypeOrmProductSettingsRepository },
  { provide: MEDIA_REPOSITORY, useClass: TypeOrmMediaRepository },
  VendureAssetReads,
  { provide: MEDIA_STORAGE, useClass: VendureMediaStorage },
  { provide: DESCRIPTION_SANITIZER, useClass: HtmlDescriptionSanitizer },
  { provide: CLOCK, useValue: SYSTEM_CLOCK },
  { provide: TAXONOMY_LOCK, useClass: PgTaxonomyLock },
  { provide: MEDIA_LOCK, useClass: PgMediaLock },
  // One registry for the module: team registers its check on it, the use cases read it (D2114, D2137).
  { provide: ORDER_MANAGER_CHECK_REGISTRAR, useClass: OrderManagerCheckRegistry },
  // The manual sold-out flag until stock exists; P6.S1 provides its stock source on this token instead (D2107).
  {
    provide: SOLD_OUT_SOURCE,
    useFactory: (settings: ProductSettingsRepositoryPort) => new SettingsFlagSoldOutSource(settings),
    inject: [PRODUCT_SETTINGS_REPOSITORY],
  },
  { provide: STORE_SETTINGS, useClass: TenancyStoreSettings },
  {
    provide: ID_GENERATOR,
    useFactory: (ids: SnowflakeIdGeneratorPort) => new SnowflakeCatalogIdGenerator(ids),
    inject: [SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: TAG_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory, ids: IdGeneratorPort) => new TypeOrmTagRepository(factory, ids),
    inject: [TenantRepositoryFactory, ID_GENERATOR],
  },
  {
    provide: HIGHLIGHT_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory, ids: IdGeneratorPort) =>
      new TypeOrmHighlightRepository(factory, ids),
    inject: [TenantRepositoryFactory, ID_GENERATOR],
  },
  {
    provide: PRODUCT_COLLECTION_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory, ids: IdGeneratorPort) =>
      new TypeOrmProductCollectionRepository(factory, ids),
    inject: [TenantRepositoryFactory, ID_GENERATOR],
  },
  {
    provide: PRODUCT_PORTS,
    useFactory: (...adapters: ProductPorts[keyof ProductPorts][]): ProductPorts =>
      Object.fromEntries(PORT_KEYS.map((key, index) => [key, adapters[index]])) as unknown as ProductPorts,
    inject: [...PORT_TOKENS],
  },
  useCase(CreateProductService),
  useCase(UpdateProductService),
  useCase(GetProductService),
  useCase(ListProductsService),
  useCase(SetProductStatusService),
  useCase(DeleteProductService),
  useCase(SlugAvailabilityService),
  useCase(BrandService),
  useCase(TagService),
  useCase(HighlightService),
  useCase(MediaLibraryService),
  useCase(SoldOutService),
  useCase(CatalogReadService),
  useCase(DemoCatalogSeedService),
];
