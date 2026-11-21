/**
 * The only module of the merchant shell that another plugin's dashboard imports, as
 * `@cod/plugin-merchant-shell/shell-api` (D83, D92). Dashboard code only: it reaches `@vendure/dashboard`.
 */
export { registerShellPage, type ShellPage } from './registry/shell-pages';
export { ACTIVE_STORE_ALIAS, storePathFor } from './model/store-path';
export type { ShellLeafId } from './model/tree';
export type { ShellPageProps, SwitchableStoreView } from './model/types';
export { useActiveStore } from './hooks/use-store-session';
export { type SubdomainCheck, useSubdomainAvailability } from './hooks/use-subdomain-availability';
export { StoreLanguageSelect } from './components/store-language-select';
export { SubdomainField } from './components/subdomain-field';
export { TextField } from './components/text-field';
export { DEFAULT_STORE_LANGUAGE, STORE_LANGUAGE_OPTIONS, SUBDOMAIN_REASON_MESSAGE_IDS } from './constants';
export { usePlatformStaff } from './hooks/use-platform-staff';
export { MerchantNotFound } from './components/merchant-route-guard';
export { StoreScopedPage, type StoreScopedPageProps } from './components/store-scoped-page';
// Store-bound queries and writes for the dashboards of later plugins (catalog-packs, catalog-import; D2201), copied
// from catalog's own, which keeps its copy until a follow-up moves it here.
export { readRequestToken, type StoreScope, storeQuery } from './store-bound/store-query';
export {
  fetchForStore,
  isStoreSwitched,
  isStoreTokenMissing,
  retriesStoreSwitch,
  sendForStore,
  StoreSwitchedError,
  StoreTokenMissingError,
} from './store-bound/store-fetch';
export { placeholderWithinStore } from './store-bound/store-placeholder';
export { useStoreScope } from './store-bound/use-store-scope';
export { HELD_PERMISSIONS_QUERY_KEY, useHeldPermissions } from './store-bound/use-held-permissions';
