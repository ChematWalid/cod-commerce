import { type SnowflakeIdGeneratorPort, SNOWFLAKE_ID_GENERATOR, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import type { Provider } from '@nestjs/common';
import type { CollectionPorts } from '../application/collection-ports';
import { CollectionMembershipQueries } from '../application/collection-membership-queries.service';
import { CollectionProductsService } from '../application/collection-products.service';
import { CreateCollectionService } from '../application/create-collection.service';
import { DemoCollectionSeedService } from '../application/demo-collection-seed.service';
import { DeleteCollectionService } from '../application/delete-collection.service';
import { GetCollectionService } from '../application/get-collection.service';
import { ListCollectionsService } from '../application/list-collections.service';
import { PreviewMatchesService } from '../application/preview-matches.service';
import { ProductCollectionsService } from '../application/product-collections.service';
import { ProductLinksService } from '../application/product-links.service';
import { ProductSearchService } from '../application/product-search.service';
import { RecomputeMembershipService } from '../application/recompute-membership.service';
import { ReconcileSweepService } from '../application/reconcile-sweep.service';
import { RecomputeStoreService } from '../application/recompute-store.service';
import { RuleOptionsService } from '../application/rule-options.service';
import { SaveRecomputeService, type SaveTimeRecompute } from '../application/save-recompute.service';
import { SetCollectionProductsService } from '../application/set-collection-products.service';
import { SlugAvailabilityService } from '../application/slug-availability.service';
import {
  BUSINESS_DIRECTORY,
  COLLECTION_EVENTS,
  COLLECTION_PORTS,
  DEFINITION_REPOSITORY,
  DESCRIPTION_SANITIZER,
  ID_GENERATOR,
  MEMBER_REPOSITORY,
  PRODUCT_FACTS,
  STORE_LOCK,
  STORE_RECONCILE_QUEUE,
  TRANSACTION,
  VENDURE_COLLECTIONS,
} from '../application/tokens';
import { UpdateCollectionService } from '../application/update-collection.service';
import type { BusinessDirectoryPort } from '../domain/ports/business-directory.port';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';
import type { StoreReconcileQueuePort } from '../domain/ports/store-reconcile.port';
import { CatalogCollectionsReadService } from './catalog-collections-read';
import { CatalogProductFactsAdapter } from './catalog-product-facts.adapter';
import { CatalogVisibleProducts } from './catalog-visible-products.adapter';
import { OutboxCollectionEvents } from './collection-events';
import { CollectionsMembershipSource } from './collections-membership.source';
import { HtmlDescriptionSanitizer } from './description-sanitizer';
import { CollectionsMembershipConsumer } from './membership.consumer';
import { OffersCollectionMembershipSource } from './offers-collection-membership.source';
import { PgCollectionsLock } from './pg-collections-lock';
import { MatchVersionCheck } from './reconcile.task';
import { PlatformStoreReconcileQueue, RecomputeStoreJob } from './recompute-store.job';
import { SnowflakeCollectionsIdGenerator } from './snowflake-id.generator';
import { StockFiltersOff } from './stock-filters-off';
import { StoreChannelContexts } from './store-channel-context';
import { TenancyActiveStore } from './tenancy-active-store.adapter';
import { TenancyBusinessDirectoryAdapter } from './tenancy-business-directory.adapter';
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

/** A use case that saves a collection and recomputes its members through the one registered recompute. */
const savingUseCase = (type: new (ports: CollectionPorts, recompute: SaveTimeRecompute) => object): Provider => ({
  provide: type,
  useFactory: (ports: CollectionPorts, recompute: SaveTimeRecompute) => new type(ports, recompute),
  inject: [COLLECTION_PORTS, SaveRecomputeService],
});

/** The reconcile side (D2336): the store job, the save-time cap and the sweeps. */
const RECONCILE_PROVIDERS: Provider[] = [
  { provide: BUSINESS_DIRECTORY, useClass: TenancyBusinessDirectoryAdapter },
  {
    provide: RecomputeStoreService,
    useFactory: (ports: CollectionPorts, recompute: RecomputeMembershipService) =>
      new RecomputeStoreService(ports, recompute),
    inject: [COLLECTION_PORTS, RecomputeMembershipService],
  },
  PlatformStoreReconcileQueue,
  { provide: STORE_RECONCILE_QUEUE, useExisting: PlatformStoreReconcileQueue },
  RecomputeStoreJob,
  {
    provide: SaveRecomputeService,
    useFactory: (recompute: RecomputeMembershipService, ports: CollectionPorts, queue: StoreReconcileQueuePort) =>
      new SaveRecomputeService(recompute, ports.facts, queue),
    inject: [RecomputeMembershipService, COLLECTION_PORTS, STORE_RECONCILE_QUEUE],
  },
  {
    provide: ReconcileSweepService,
    useFactory: (ports: CollectionPorts, directory: BusinessDirectoryPort, queue: StoreReconcileQueuePort) =>
      new ReconcileSweepService(ports.definitions, directory, queue),
    inject: [COLLECTION_PORTS, BUSINESS_DIRECTORY, STORE_RECONCILE_QUEUE],
  },
  CollectionsMembershipConsumer,
  MatchVersionCheck,
];

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
  // Saves recompute through the save-time service: over the sync cap it queues the store reconcile (D2312).
  savingUseCase(CreateCollectionService),
  savingUseCase(UpdateCollectionService),
  // The server's demo seed gives the demo stores their collections (P3.S2).
  savingUseCase(DemoCollectionSeedService),
  useCase(DeleteCollectionService),
  useCase(ListCollectionsService),
  useCase(GetCollectionService),
  useCase(CollectionProductsService),
  useCase(SetCollectionProductsService),
  {
    provide: ProductCollectionsService,
    useFactory: (ports: CollectionPorts, links: ProductLinksService) => new ProductCollectionsService(ports, links),
    inject: [COLLECTION_PORTS, ProductLinksService],
  },
  useCase(SlugAvailabilityService),
  useCase(ProductLinksService),
  useCase(RecomputeMembershipService),
  useCase(PreviewMatchesService),
  useCase(RuleOptionsService),
  useCase(ProductSearchService),
  CollectionsMembershipSource,
  ...RECONCILE_PROVIDERS,
  // The reads other plugins import (D2316, D2317).
  TenancyActiveStore,
  CatalogVisibleProducts,
  CatalogCollectionsReadService,
  useCase(CollectionMembershipQueries),
  // The offers' collection targets read the same membership (D2341).
  OffersCollectionMembershipSource,
];

/** What the plugin module exports to other plugins and the server's demo seed, through `index.ts` (D2316, D2317). */
export const COLLECTIONS_EXPORTS = [
  CatalogCollectionsReadService,
  CollectionMembershipQueries,
  DemoCollectionSeedService,
];
