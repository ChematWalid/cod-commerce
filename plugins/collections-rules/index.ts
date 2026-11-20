// The public entry of collections-rules (D2317, rule `collections-entry-infra-only`): another plugin imports it only
// from its infrastructure/, its root *.plugin.ts file or its tests/; of the apps only apps/server does.
export { CollectionsRulesPlugin } from './collections-rules.plugin';
export { CatalogCollectionsReadService as CollectionsReadService } from './infrastructure/catalog-collections-read';
export type { VisibleCollection, VisibleCollectionPage } from './application/collections-read.service';
export { CollectionMembershipQueries } from './application/collection-membership-queries.service';
export { CollectionsNoActiveStoreError } from './domain/no-active-store.error';
export type { StoreScope as CollectionsStoreScope } from './domain/store-scope';
export {
  asOperationContext as asCollectionsOperationContext,
  type OperationContext as CollectionsOperationContext,
} from './domain/ports/operation-context';
