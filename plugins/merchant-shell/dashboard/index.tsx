import './styles/rtl.css';
import { defineDashboardExtension } from '@vendure/dashboard';
import { AccountMenu } from './components/account-menu';
import { AssistantPlaceholder } from './components/assistant-placeholder';
import { CreditsPlaceholder } from './components/credits-placeholder';
import { DocumentLangSync } from './components/document-lang-sync';
import { LoginBrand, LoginWelcome } from './components/login-brand';
import { MerchantRouteGuard } from './components/merchant-route-guard';
import { NotificationsPlaceholder } from './components/notifications-placeholder';
import { PlatformStaffFlag } from './components/platform-staff-flag';
import { StoreSwitcher } from './components/store-switcher';
import { TrialBanner } from './components/trial-banner';
import {
  ACCOUNT_TOOLBAR_ITEM_ID,
  ASSISTANT_TOOLBAR_ITEM_ID,
  CREDITS_TOOLBAR_ITEM_ID,
  DOCUMENT_LANG_PROVIDER_ID,
  MERCHANT_ROUTE_GUARD_PROVIDER_ID,
  NOTIFICATIONS_TOOLBAR_ITEM_ID,
  PLATFORM_STAFF_FLAG_PROVIDER_ID,
  STOCK_ALERTS_TOOLBAR_ITEM_ID,
  STORE_SWITCHER_TOOLBAR_ITEM_ID,
  TRIAL_BANNER_PROVIDER_ID,
  TRIAL_BANNER_PROVIDER_ORDER,
} from './constants';
import { buildMerchantNav } from './model/nav-config';
import { SHELL_NAV_ICONS } from './nav/icons';
import { shellRoutes } from './routes/shell-routes';
import { shellPlaceholderRoute } from './routes/shell-placeholder';

defineDashboardExtension({
  routes: [shellPlaceholderRoute, ...shellRoutes],
  navSections: (config) => buildMerchantNav(config, SHELL_NAV_ICONS),
  login: { logo: { component: LoginBrand }, beforeForm: { component: LoginWelcome } },
  // Items without a position come first, in this order; the bell replaces the stock alerts and the account menu follows.
  toolbarItems: [
    { id: CREDITS_TOOLBAR_ITEM_ID, component: CreditsPlaceholder },
    { id: ASSISTANT_TOOLBAR_ITEM_ID, component: AssistantPlaceholder },
    { id: STORE_SWITCHER_TOOLBAR_ITEM_ID, component: StoreSwitcher },
    {
      id: NOTIFICATIONS_TOOLBAR_ITEM_ID,
      component: NotificationsPlaceholder,
      position: { itemId: STOCK_ALERTS_TOOLBAR_ITEM_ID, order: 'replace' },
    },
    {
      id: ACCOUNT_TOOLBAR_ITEM_ID,
      component: AccountMenu,
      position: { itemId: STOCK_ALERTS_TOOLBAR_ITEM_ID, order: 'after' },
    },
  ],
  customProviders: [
    { id: DOCUMENT_LANG_PROVIDER_ID, component: DocumentLangSync },
    { id: PLATFORM_STAFF_FLAG_PROVIDER_ID, component: PlatformStaffFlag },
    { id: MERCHANT_ROUTE_GUARD_PROVIDER_ID, location: 'layout', component: MerchantRouteGuard },
    {
      id: TRIAL_BANNER_PROVIDER_ID,
      location: 'layout',
      order: TRIAL_BANNER_PROVIDER_ORDER,
      component: TrialBanner,
    },
  ],
});
