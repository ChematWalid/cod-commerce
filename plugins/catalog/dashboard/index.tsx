import './styles/catalog.css';
import { registerShellPage } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { ProductListPage } from './routes/product-list-page';

// The list fills the shell's `products.all` leaf (D2110); the editor routes are added by Task 16.
registerShellPage('products.all', { component: ProductListPage });

defineDashboardExtension({});
