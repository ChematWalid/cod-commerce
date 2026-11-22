import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import { ProjectionService } from '../application/projection.service';
import { StorefrontCatalogService } from '../application/storefront-catalog.service';
import { CatalogProjectionSource } from './catalog-projection-source';
import { ProjectionBackfill } from './projection-backfill';
import { StorefrontProjectionConsumer } from './projection.consumer';
import { CatalogStorefrontReads } from './storefront-reads.adapter';
import { TenancyStorefrontStore } from './tenancy-storefront-store.adapter';
import { TypeOrmProjectionRepository } from './typeorm-projection.repository';

/** Every provider of the storefront API: the adapters, the use cases built from them, the consumer and the backfill. */
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
    provide: ProjectionService,
    useFactory: (
      stores: TenancyStorefrontStore,
      source: CatalogProjectionSource,
      projection: TypeOrmProjectionRepository,
    ) => new ProjectionService({ stores, source, projection }),
    inject: [TenancyStorefrontStore, CatalogProjectionSource, TypeOrmProjectionRepository],
  },
  StorefrontProjectionConsumer,
  ProjectionBackfill,
];
