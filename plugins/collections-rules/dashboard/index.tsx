import './styles/collections.css';
import { registerShellPage, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_EDITOR_BLOCK_IDS, CATALOG_PRODUCT_EDITOR_PAGE_ID } from '@cod/shared';
import { defineDashboardExtension } from '@vendure/dashboard';
import { ProductCollectionsBlock, ProductCollectionsTitle } from './components/product-collections-block';
import { collectionPathOf, NEW_COLLECTION_PATH, PRODUCT_COLLECTIONS_BLOCK_ID } from './constants';
import { EditCollectionPage, NewCollectionPage } from './routes/collection-editor-page';
import { CollectionListPage } from './routes/collection-list-page';

/** The router's names for the URL's store and collection. */
const STORE_ID_PARAM = '$storeId';
const COLLECTION_ID_PARAM = '$collectionId';

// The list fills the shell's `products.collections` leaf, never a stock nav item; the editor routes are store-scoped
// pages outside the sidebar (D2110). Catalog's product editor gets the collections block in its side column (D2324a).
registerShellPage('products.collections', { component: CollectionListPage });

defineDashboardExtension({
  routes: [
    { path: storePathFor(NEW_COLLECTION_PATH, STORE_ID_PARAM), component: () => <NewCollectionPage /> },
    {
      path: storePathFor(collectionPathOf(COLLECTION_ID_PARAM), STORE_ID_PARAM),
      component: () => <EditCollectionPage />,
    },
  ],
  pageBlocks: [
    {
      id: PRODUCT_COLLECTIONS_BLOCK_ID,
      title: <ProductCollectionsTitle />,
      location: {
        pageId: CATALOG_PRODUCT_EDITOR_PAGE_ID,
        column: 'side',
        position: { blockId: CATALOG_EDITOR_BLOCK_IDS.organisation, order: 'after' },
      },
      component: () => <ProductCollectionsBlock />,
    },
  ],
});
