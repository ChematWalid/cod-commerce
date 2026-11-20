import './styles/offers.css';
import { registerShellPage } from '@cod/plugin-merchant-shell/shell-api';
import { OfferListPage } from './routes/offer-list-page';

// The list fills the shell's `products.offers` leaf (D2523); the editor routes below `offers/` come with the editor.
registerShellPage('products.offers', { component: OfferListPage });
