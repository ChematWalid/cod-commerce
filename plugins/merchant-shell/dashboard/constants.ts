import type { PermissionKey, PlatformLanguageCode, SubdomainReasonCode } from '@cod/shared';

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

/** The toolbar item of the store switcher, and the marker of its control in the DOM. */
export const STORE_SWITCHER_TOOLBAR_ITEM_ID = 'merchant-store-switcher';
export const STORE_SWITCHER_TEST_ID = 'merchant-store-switcher';
export const STORE_CREATE_TEST_ID = 'merchant-store-create';
export const CREATE_STORE_DIALOG_TEST_ID = 'merchant-create-store-dialog';

/** The permission Create Store is shown for (D87); the server enforces it again. */
export const CREATE_STORE_PERMISSION: PermissionKey = 'store.stores.create';

/** How long a new store's channel may take to reach the session before the merchant is told (D87). */
export const STORE_SWITCH_TIMEOUT_MS = 10_000;

/** How long the subdomain field waits after the last keystroke before asking the server. */
export const SUBDOMAIN_DEBOUNCE_MS = 400;
/** Used when a `429` carries no readable `Retry-After`. */
export const SUBDOMAIN_RETRY_FALLBACK_SECONDS = 10;
export const SUBDOMAIN_AVAILABILITY_ENDPOINT = '/stores/subdomain-availability';
export const HTTP_TOO_MANY_REQUESTS = 429;
export const MS_PER_SECOND = 1000;

/** The catalogue id of each reason the server gives for an unusable subdomain (D39). */
export const SUBDOMAIN_REASON_MESSAGE_IDS: Readonly<Record<SubdomainReasonCode, string>> = {
  length: 'subdomain.length',
  format: 'subdomain.format',
  punycode: 'subdomain.punycode',
  reserved: 'subdomain.reserved',
  taken: 'subdomain.taken',
};
export const SUBDOMAIN_RATE_LIMITED_MESSAGE_ID = 'subdomain.rate-limited';
export const SUBDOMAIN_AVAILABLE_MESSAGE_ID = 'subdomain.available';
export const SUBDOMAIN_CHECKING_MESSAGE_ID = 'subdomain.checking';
export const SUBDOMAIN_CHECK_FAILED_MESSAGE_ID = 'subdomain.check-failed';

/** The stable codes `createStore` answers with for an unusable subdomain. */
export const SUBDOMAIN_TAKEN_ERROR_CODE = 'tenancy.subdomain-taken';
export const SUBDOMAIN_INVALID_ERROR_CODE = 'tenancy.subdomain-invalid';

export const CREATE_STORE_FAILED_MESSAGE_ID = 'shell.store.create.failed';
export const STORE_SWITCH_TIMEOUT_MESSAGE_ID = 'shell.store.create.switch-timeout';

/** Store languages, labelled in their own language whatever the dashboard's language is. */
export const STORE_LANGUAGE_OPTIONS: readonly { readonly code: PlatformLanguageCode; readonly label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];
export const DEFAULT_STORE_LANGUAGE: PlatformLanguageCode = 'ar';
