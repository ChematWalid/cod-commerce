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
