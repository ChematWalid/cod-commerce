import './styles/rtl.css';
import { defineDashboardExtension } from '@vendure/dashboard';
import { DocumentLangSync } from './components/document-lang-sync';
import { LoginBrand, LoginWelcome } from './components/login-brand';
import { MerchantRouteGuard } from './components/merchant-route-guard';
import { PlatformStaffFlag } from './components/platform-staff-flag';
import { StoreSwitcher } from './components/store-switcher';
import {
  DOCUMENT_LANG_PROVIDER_ID,
  MERCHANT_ROUTE_GUARD_PROVIDER_ID,
  PLATFORM_STAFF_FLAG_PROVIDER_ID,
  STORE_SWITCHER_TOOLBAR_ITEM_ID,
} from './constants';
import { buildMerchantNav } from './model/nav-config';
import { SHELL_NAV_ICONS } from './nav/icons';
import { shellRoutes } from './routes/shell-routes';
import { shellPlaceholderRoute } from './routes/shell-placeholder';

defineDashboardExtension({
  routes: [shellPlaceholderRoute, ...shellRoutes],
  navSections: (config) => buildMerchantNav(config, SHELL_NAV_ICONS),
  login: { logo: { component: LoginBrand }, beforeForm: { component: LoginWelcome } },
  toolbarItems: [{ id: STORE_SWITCHER_TOOLBAR_ITEM_ID, component: StoreSwitcher }],
  customProviders: [
    { id: DOCUMENT_LANG_PROVIDER_ID, component: DocumentLangSync },
    { id: PLATFORM_STAFF_FLAG_PROVIDER_ID, component: PlatformStaffFlag },
    { id: MERCHANT_ROUTE_GUARD_PROVIDER_ID, location: 'layout', component: MerchantRouteGuard },
  ],
});
