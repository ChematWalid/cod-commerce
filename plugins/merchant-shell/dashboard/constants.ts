/** The route of the shell placeholder page, below the dashboard base (`/dashboard`). */
export const SHELL_PLACEHOLDER_PATH = '/merchant-shell';

/** The self-hosted Arabic UI font (ADR 0010); `styles/rtl.css` names the same family. */
export const ARABIC_FONT_FAMILY = 'IBM Plex Sans Arabic';

/** Marks the shell placeholder page as rendered. */
export const SHELL_PLACEHOLDER_TEST_ID = 'merchant-shell-placeholder';

/** Holds the platform language codes read from `@cod/shared`. */
export const PLATFORM_LANGUAGES_TEST_ID = 'platform-languages';

/** The id of the provider that keeps `html[lang]` in step with the display language. */
export const DOCUMENT_LANG_PROVIDER_ID = 'merchant-shell-document-lang';

/** The ids of the providers behind the sidebar hide rule (D79) and the merchant route guard (D84). */
export const PLATFORM_STAFF_FLAG_PROVIDER_ID = 'merchant-shell-platform-staff-flag';
export const MERCHANT_ROUTE_GUARD_PROVIDER_ID = 'merchant-shell-route-guard';

/** The attribute on `<html>` that keeps the stock sidebar header and footer visible; `styles/rtl.css` reads it. */
export const PLATFORM_STAFF_ATTRIBUTE = 'data-platform-staff';

/** Marks a leaf whose page is not built yet. */
export const SHELL_SKELETON_TEST_ID = 'shell-skeleton';

/** Marks the page a merchant gets for a URL that is not part of the shell, or a store they cannot reach. */
export const MERCHANT_NOT_FOUND_TEST_ID = 'merchant-not-found';

/** Marks the page shown when the active store does not grant the leaf's permission. */
export const SHELL_FORBIDDEN_TEST_ID = 'shell-forbidden';

export const SWITCHABLE_STORES_QUERY_KEY = ['merchant-shell', 'switchable-stores'] as const;

/** The stock channel provider's query key for the active channel, matched as a prefix. */
export const ACTIVE_CHANNEL_QUERY_KEY = ['activeChannel'] as const;

/** The dashboard's localStorage key of the channel token every request is sent with. */
export const SELECTED_CHANNEL_TOKEN_STORAGE_KEY = 'vendure-selected-channel-token';

/** Marks the product name that replaces the stock logo on the login page. */
export const LOGIN_BRAND_TEST_ID = 'login-brand';
