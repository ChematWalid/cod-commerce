import { registerShellPage, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { NEW_PRICING_PATH, pricingPathOf } from './constants';
import { DeliveryPage } from './routes/delivery-page';
import { EditPricingPage, NewPricingPage } from './routes/pricing-editor-page';

/** The router's names for the URL's store and pricing option. */
const STORE_ID_PARAM = '$storeId';
const GROUP_ID_PARAM = '$groupId';

// The Carriers and Delivery pricing tabs fill the shell's `delivery` leaf, never a stock nav item; the pricing option
// editor routes are store-scoped pages outside the sidebar (D2110).
registerShellPage('delivery', { component: DeliveryPage });

defineDashboardExtension({
  routes: [
    { path: storePathFor(NEW_PRICING_PATH, STORE_ID_PARAM), component: () => <NewPricingPage /> },
    { path: storePathFor(pricingPathOf(GROUP_ID_PARAM), STORE_ID_PARAM), component: () => <EditPricingPage /> },
  ],
});
