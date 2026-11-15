import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import {
  DEFINITION_REPOSITORY,
  ID_GENERATOR,
  MEMBER_REPOSITORY,
  PRODUCT_FACTS,
  STORE_LOCK,
} from '../application/tokens';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import { CatalogProductFactsAdapter } from './catalog-product-facts.adapter';
import { PgCollectionsLock } from './pg-collections-lock';
import { SnowflakeCollectionsIdGenerator } from './snowflake-id.generator';
import { StockFiltersOff } from './stock-filters-off';
import { StoreChannelContexts } from './store-channel-context';
import { TypeOrmCollectionDefinitionRepository } from './typeorm-collection-definition.repository';
import { TypeOrmCollectionMemberRepository } from './typeorm-collection-member.repository';

/** Wires the persistence, the store lock, the catalog facts and the store-channel contexts to their ports (D2300). */
export const COLLECTIONS_PROVIDERS: Provider[] = [
  StockFiltersOff,
  StoreChannelContexts,
  {
    provide: ID_GENERATOR,
    useFactory: (ids: SnowflakeIdGeneratorPort) => new SnowflakeCollectionsIdGenerator(ids),
    inject: [SNOWFLAKE_ID_GENERATOR],
  },
  {
    provide: DEFINITION_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory) => new TypeOrmCollectionDefinitionRepository(factory),
    inject: [TenantRepositoryFactory],
  },
  {
    provide: MEMBER_REPOSITORY,
    useFactory: (factory: TenantRepositoryFactory, ids: IdGeneratorPort) =>
      new TypeOrmCollectionMemberRepository(factory, ids),
    inject: [TenantRepositoryFactory, ID_GENERATOR],
  },
  { provide: STORE_LOCK, useClass: PgCollectionsLock },
  { provide: PRODUCT_FACTS, useClass: CatalogProductFactsAdapter },
];
