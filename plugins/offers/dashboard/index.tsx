import './styles/offers.css';
import { registerShellPage, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { defineDashboardExtension } from '@vendure/dashboard';
import { NEW_OFFER_PATH, offerPathOf } from './constants';
import { EditOfferPage, NewOfferPage } from './routes/offer-editor-page';
import { OfferListPage } from './routes/offer-list-page';

/** The router's names for the URL's store and offer. */
const STORE_ID_PARAM = '$storeId';
const OFFER_ID_PARAM = '$offerId';

// The list fills the shell's `products.offers` leaf; the editor routes are store-scoped pages outside the sidebar (D2523).
registerShellPage('products.offers', { component: OfferListPage });

defineDashboardExtension({
  routes: [
    { path: storePathFor(NEW_OFFER_PATH, STORE_ID_PARAM), component: () => <NewOfferPage /> },
    { path: storePathFor(offerPathOf(OFFER_ID_PARAM), STORE_ID_PARAM), component: () => <EditOfferPage /> },
  ],
});
