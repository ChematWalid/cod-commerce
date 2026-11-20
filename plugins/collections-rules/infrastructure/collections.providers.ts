import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import type { CollectionPorts } from '../application/collection-ports';
import { CollectionProductsService } from '../application/collection-products.service';
import { CreateCollectionService } from '../application/create-collection.service';
import { DeleteCollectionService } from '../application/delete-collection.service';
import { GetCollectionService } from '../application/get-collection.service';
import { ListCollectionsService } from '../application/list-collections.service';
import { ProductCollectionsService } from '../application/product-collections.service';
import { ProductLinksService } from '../application/product-links.service';
import { SetCollectionProductsService } from '../application/set-collection-products.service';
import { SlugAvailabilityService } from '../application/slug-availability.service';
import {
  COLLECTION_EVENTS,
  COLLECTION_PORTS,
  DEFINITION_REPOSITORY,
  DESCRIPTION_SANITIZER,
  ID_GENERATOR,
  MEMBER_REPOSITORY,
  PRODUCT_FACTS,
  STORE_LOCK,
  TRANSACTION,
  VENDURE_COLLECTIONS,
} from '../application/tokens';
import { UpdateCollectionService } from '../application/update-collection.service';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import { CatalogProductFactsAdapter } from './catalog-product-facts.adapter';
import { OutboxCollectionEvents } from './collection-events';
import { CollectionsMembershipSource } from './collections-membership.source';
import { HtmlDescriptionSanitizer } from './description-sanitizer';
import { PgCollectionsLock } from './pg-collections-lock';
import { SnowflakeCollectionsIdGenerator } from './snowflake-id.generator';
import { StockFiltersOff } from './stock-filters-off';
import { StoreChannelContexts } from './store-channel-context';
import { TransactionAdapter } from './transaction.adapter';
import { TypeOrmCollectionDefinitionRepository } from './typeorm-collection-definition.repository';
import { TypeOrmCollectionMemberRepository } from './typeorm-collection-member.repository';
import { VendureCollectionsAdapter } from './vendure-collections.adapter';

/** The token of each port of the bundle; the factory below fills the bundle from them. */
const PORT_TOKEN_OF = {
  transaction: TRANSACTION,
  lock: STORE_LOCK,
  definitions: DEFINITION_REPOSITORY,
  members: MEMBER_REPOSITORY,
  vendure: VENDURE_COLLECTIONS,
  events: COLLECTION_EVENTS,
  ids: ID_GENERATOR,
  sanitizer: DESCRIPTION_SANITIZER,
  facts: PRODUCT_FACTS,
} as const satisfies Record<keyof CollectionPorts, symbol>;

const PORT_ENTRIES = Object.entries(PORT_TOKEN_OF) as readonly [keyof CollectionPorts, symbol][];

/** A use case built from the port bundle, so `application/` stays framework-free. */
const useCase = (type: new (ports: CollectionPorts) => object): Provider => ({
  provide: type,
  useFactory: (ports: CollectionPorts) => new type(ports),
  inject: [COLLECTION_PORTS],
});

/** Wires the persistence, the store lock, Vendure, the outbox and the catalog facts to their ports (D2300). */
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
  { provide: TRANSACTION, useClass: TransactionAdapter },
  { provide: VENDURE_COLLECTIONS, useClass: VendureCollectionsAdapter },
  { provide: COLLECTION_EVENTS, useClass: OutboxCollectionEvents },
  { provide: DESCRIPTION_SANITIZER, useClass: HtmlDescriptionSanitizer },
  {
    provide: COLLECTION_PORTS,
    // Nest hands the adapters in `inject` order, which is PORT_ENTRIES' own order: each lands on its entry's key.
    useFactory: (...adapters: unknown[]): CollectionPorts =>
      Object.fromEntries(PORT_ENTRIES.map(([key], index) => [key, adapters[index]])) as unknown as CollectionPorts,
    inject: PORT_ENTRIES.map(([, token]) => token),
  },
  useCase(CreateCollectionService),
  useCase(UpdateCollectionService),
  useCase(DeleteCollectionService),
  useCase(ListCollectionsService),
  useCase(GetCollectionService),
  useCase(CollectionProductsService),
  useCase(SetCollectionProductsService),
  useCase(ProductCollectionsService),
  useCase(SlugAvailabilityService),
  useCase(ProductLinksService),
  CollectionsMembershipSource,
];
