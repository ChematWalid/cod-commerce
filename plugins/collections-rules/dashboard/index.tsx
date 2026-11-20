import './styles/collections.css';
import { registerShellPage, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { collectionPathOf, NEW_COLLECTION_PATH } from './constants';
import { EditCollectionPage, NewCollectionPage } from './routes/collection-editor-page';
import { CollectionListPage } from './routes/collection-list-page';

/** The router's names for the URL's store and collection. */
const STORE_ID_PARAM = '$storeId';
const COLLECTION_ID_PARAM = '$collectionId';

// The list fills the shell's `products.collections` leaf, never a stock nav item; the editor routes are store-scoped
// pages outside the sidebar (D2110). The product-editor block comes with Task 12 (D2324).
registerShellPage('products.collections', { component: CollectionListPage });

defineDashboardExtension({
  routes: [
    { path: storePathFor(NEW_COLLECTION_PATH, STORE_ID_PARAM), component: () => <NewCollectionPage /> },
    {
      path: storePathFor(collectionPathOf(COLLECTION_ID_PARAM), STORE_ID_PARAM),
      component: () => <EditCollectionPage />,
    },
  ],
});
