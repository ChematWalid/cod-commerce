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
// `data-testid`s and paths of the collections pages, for the server's browser specs and the evidence script.
export {
  ADD_PRODUCTS_TEST_ID,
  COLLECTION_EDITOR_TEST_ID,
  COLLECTION_LIST_TEST_ID,
  COLLECTION_MATCH_ALL_TEST_ID,
  COLLECTION_MATCH_ANY_TEST_ID,
  COLLECTION_MODE_TEST_ID,
  COLLECTION_POSITION_TEST_ID,
  COLLECTION_ROW_TEST_ID,
  COLLECTION_SAVE_TEST_ID,
  COLLECTION_TITLE_TEST_ID,
  COLLECTION_VISIBLE_TEST_ID,
  COLLECTIONS_EMPTY_TEST_ID,
  CONDITION_ROW_TEST_ID,
  CREATE_COLLECTION_TEST_ID,
  MANUAL_PRODUCT_ROW_TEST_ID,
  MODE_SWITCH_CONFIRM_TEST_ID,
  PREVIEW_COUNT_TEST_ID,
  PRODUCT_COLLECTIONS_BLOCK_TEST_ID,
} from './dashboard/constants';
