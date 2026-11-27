import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { ProjectionService } from '../application/projection.service';
import { ShippingQuoteUseCase } from '../application/shipping-quote.use-case';
import { StorefrontCatalogService } from '../application/storefront-catalog.service';
import { StorefrontSearchService } from '../application/storefront-search.service';
import { CatalogProjectionSource } from './catalog-projection-source';
import { DeliveryPricingQuoteAdapter } from './delivery-quote.adapter';
import { ProjectionBackfill } from './projection-backfill';
import { StorefrontProjectionConsumer } from './projection.consumer';
import { CatalogStorefrontReads } from './storefront-reads.adapter';
import { TypeOrmStorefrontSearch } from './storefront-search.query';
import { TenancyStorefrontStore } from './tenancy-storefront-store.adapter';
import { TypeOrmProjectionRepository } from './typeorm-projection.repository';
import { TypeOrmSynonymRepository } from './typeorm-synonym.repository';

/**
 * Every provider of the storefront API: the adapters, the use cases built from them (catalog, search and quotes), the
 * consumer and the backfill.
 */
export const STOREFRONT_API_PROVIDERS: Provider[] = [
  TenancyStorefrontStore,
  CatalogProjectionSource,
  CatalogStorefrontReads,
  {
    provide: TypeOrmProjectionRepository,
    useFactory: (repositories: TenantRepositoryFactory, ids: SnowflakeIdGeneratorPort) =>
      new TypeOrmProjectionRepository(repositories, ids),
    inject: [TenantRepositoryFactory, SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: StorefrontCatalogService,
    useFactory: (
      stores: TenancyStorefrontStore,
      projection: TypeOrmProjectionRepository,
      reads: CatalogStorefrontReads,
    ) => new StorefrontCatalogService({ stores, projection, reads }),
    inject: [TenancyStorefrontStore, TypeOrmProjectionRepository, CatalogStorefrontReads],
  },
  {
    provide: TypeOrmStorefrontSearch,
    useFactory: (repositories: TenantRepositoryFactory) => new TypeOrmStorefrontSearch(repositories),
    inject: [TenantRepositoryFactory],
  },
  {
    provide: TypeOrmSynonymRepository,
    useFactory: (repositories: TenantRepositoryFactory, ids: SnowflakeIdGeneratorPort) =>
      new TypeOrmSynonymRepository(repositories, ids),
    inject: [TenantRepositoryFactory, SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: StorefrontSearchService,
    useFactory: (stores: TenancyStorefrontStore, search: TypeOrmStorefrontSearch, synonyms: TypeOrmSynonymRepository) =>
      new StorefrontSearchService({ stores, search, synonyms }),
    inject: [TenancyStorefrontStore, TypeOrmStorefrontSearch, TypeOrmSynonymRepository],
  },
  {
    provide: ProjectionService,
    useFactory: (
      stores: TenancyStorefrontStore,
      source: CatalogProjectionSource,
      projection: TypeOrmProjectionRepository,
    ) => new ProjectionService({ stores, source, projection }),
    inject: [TenancyStorefrontStore, CatalogProjectionSource, TypeOrmProjectionRepository],
  },
  DeliveryPricingQuoteAdapter,
  {
    provide: ShippingQuoteUseCase,
    useFactory: (stores: TenancyStorefrontStore, delivery: DeliveryPricingQuoteAdapter) =>
      new ShippingQuoteUseCase({ stores, delivery }),
    inject: [TenancyStorefrontStore, DeliveryPricingQuoteAdapter],
  },
  StorefrontProjectionConsumer,
  ProjectionBackfill,
];
