/**
 * The only module of the merchant shell that another plugin's dashboard imports, as
 * `@cod/plugin-merchant-shell/shell-api` (D83, D92). It holds no React component and no `@vendure/dashboard` import.
 */
export { registerShellPage, type ShellPage } from './registry/shell-pages';
export { ACTIVE_STORE_ALIAS, storePathFor } from './model/store-path';
export type { ShellLeafId } from './model/tree';
export type { ShellPageProps, SwitchableStoreView } from './model/types';
