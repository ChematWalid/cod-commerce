import './styles/catalog.css';
import { registerShellPage, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { NEW_PRODUCT_PATH, productPathOf } from './constants';
import { EditProductPage, NewProductPage } from './routes/product-editor-page';
import { ProductListPage } from './routes/product-list-page';

/** The router's names for the URL's store and product. */
const STORE_ID_PARAM = '$storeId';
const PRODUCT_ID_PARAM = '$productId';

// The list fills the shell's `products.all` leaf; the editor routes are store-scoped pages outside the sidebar (D2110).
registerShellPage('products.all', { component: ProductListPage });

defineDashboardExtension({
  routes: [
    { path: storePathFor(NEW_PRODUCT_PATH, STORE_ID_PARAM), component: () => <NewProductPage /> },
    { path: storePathFor(productPathOf(PRODUCT_ID_PARAM), STORE_ID_PARAM), component: () => <EditProductPage /> },
  ],
});
