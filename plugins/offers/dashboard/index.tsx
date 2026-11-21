import './styles/offers.css';
import { registerShellPage, storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_EDITOR_BLOCK_IDS, CATALOG_PRODUCT_EDITOR_PAGE_ID } from '@cod/shared';
import { defineDashboardExtension } from '@vendure/dashboard';
import { ProductOffersBlock, ProductOffersBlockTitle, useProductOffersShown } from './components/product-offers-block';
import { NEW_OFFER_PATH, offerPathOf, PRODUCT_OFFERS_BLOCK_ID } from './constants';
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
  // The Offers block sits after catalog's organisation card in the product editor's side column (D2524); it reaches
  // catalog only through the shared page and block ids, never catalog's dashboard files.
  pageBlocks: [
    {
      id: PRODUCT_OFFERS_BLOCK_ID,
      title: <ProductOffersBlockTitle />,
      location: {
        pageId: CATALOG_PRODUCT_EDITOR_PAGE_ID,
        column: 'side',
        position: { blockId: CATALOG_EDITOR_BLOCK_IDS.organisation, order: 'after' },
      },
      component: ProductOffersBlock,
      shouldRender: useProductOffersShown,
    },
  ],
});
