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

/** The id of the provider that replaces the framework's name in the tab title (D91). */
export const DOCUMENT_TITLE_PROVIDER_ID = 'merchant-shell-document-title';

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
/** The first wait before the session is refreshed while a new store's channel is awaited; each next wait doubles. */
export const STORE_CHANNEL_POLL_MS = 1_000;

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
export const STORE_NAME_INVALID_ERROR_CODE = 'tenancy.name-invalid';

export const CREATE_STORE_FAILED_MESSAGE_ID = 'shell.store.create.failed';
export const STORE_NAME_INVALID_MESSAGE_ID = 'shell.store.create.name-invalid';
export const STORE_SWITCH_TIMEOUT_MESSAGE_ID = 'shell.store.create.switch-timeout';

/** Store languages, labelled in their own language whatever the dashboard's language is. */
export const STORE_LANGUAGE_OPTIONS: readonly { readonly code: PlatformLanguageCode; readonly label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];
export const DEFAULT_STORE_LANGUAGE: PlatformLanguageCode = 'ar';

/** The toolbar items of the top bar (D79, D93). `alerts` is the stock bell, which the merchant's bell replaces. */
export const CREDITS_TOOLBAR_ITEM_ID = 'merchant-credits';
export const ASSISTANT_TOOLBAR_ITEM_ID = 'merchant-assistant';
export const NOTIFICATIONS_TOOLBAR_ITEM_ID = 'merchant-notifications';
export const ACCOUNT_TOOLBAR_ITEM_ID = 'merchant-account';
export const STOCK_ALERTS_TOOLBAR_ITEM_ID = 'alerts';

/** The provider behind the trial banner. It sorts after the route guard (order 0), so it renders inside it. */
export const TRIAL_BANNER_PROVIDER_ID = 'merchant-shell-trial-banner';
export const TRIAL_BANNER_PROVIDER_ORDER = 1;

/** Markers of the top bar's controls. */
export const ACCOUNT_MENU_TEST_ID = 'account-menu';
export const ACCOUNT_PROFILE_TEST_ID = 'account-menu-profile';
export const ACCOUNT_SECURITY_TEST_ID = 'account-menu-security';
export const ACCOUNT_LANGUAGE_TEST_ID = 'account-menu-language';
export const ACCOUNT_THEME_TEST_ID = 'account-menu-theme';
export const ACCOUNT_LOGOUT_TEST_ID = 'account-menu-logout';
export const CREDITS_PLACEHOLDER_TEST_ID = 'credits-placeholder';
export const ASSISTANT_PLACEHOLDER_TEST_ID = 'assistant-placeholder';
export const NOTIFICATIONS_PLACEHOLDER_TEST_ID = 'notifications-placeholder';
export const TRIAL_BANNER_TEST_ID = 'trial-banner';

/** The id of an option inside the account menu, by group: `account-menu-language-ar`, `account-menu-theme-dark`. */
export const accountOptionTestId = (group: string, value: string): string => `${group}-${value}`;

/** The account menu's destinations, below the dashboard base. P1.S2 owns both pages. */
export const ACCOUNT_PROFILE_PATH = '/account/profile';
export const ACCOUNT_SECURITY_PATH = '/account/security';
export const LOGIN_PATH = '/login';

/** The display languages the account menu offers: a subset of the platform languages (ADR 0005, D72). */
export const ACCOUNT_MENU_LANGUAGES: readonly { readonly code: PlatformLanguageCode; readonly label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

/** The themes of the dashboard's `UserSettings.theme` (D90). */
export const ACCOUNT_MENU_THEMES = ['light', 'dark', 'system'] as const;
export type AccountMenuTheme = (typeof ACCOUNT_MENU_THEMES)[number];

/**
 * The session that replaces each inert placeholder (D93). A placeholder holds no data and makes no request until then:
 * the owner swaps the component, keeping the test id.
 */
export const PLACEHOLDER_HANDOFF_SESSIONS = {
  trialBanner: 'P9.S1',
  credits: 'P9.S2',
  notifications: 'P7.S3',
  assistant: 'P9.S7a',
} as const;

/** The permissions of the General settings page (the server enforces each again): see and change the business. */
export const BUSINESS_VIEW_PERMISSION: PermissionKey = 'settings.business.view';
export const BUSINESS_EDIT_PERMISSION: PermissionKey = 'settings.business.edit';
/** See the active store, and change it. */
export const STORE_VIEW_PERMISSION: PermissionKey = 'store.stores.view';
export const STORE_EDIT_PERMISSION: PermissionKey = 'store.settings.edit';

/** The query keys of the two records the page edits, prefixed by the active channel so a switch refetches. */
export const ACTIVE_BUSINESS_QUERY_KEY = ['merchant-shell', 'active-business'] as const;
export const STORE_RECORD_QUERY_KEY = ['merchant-shell', 'store'] as const;

/** Markers of the General settings page and its controls. */
export const BUSINESS_CARD_TEST_ID = 'business-profile-card';
export const BUSINESS_NAME_TEST_ID = 'business-name';
export const BUSINESS_SAVE_TEST_ID = 'business-save';
export const STORE_CARD_TEST_ID = 'store-profile-card';
export const STORE_NAME_TEST_ID = 'store-name';
export const STORE_DESCRIPTION_TEST_ID = 'store-description';
export const STORE_SAVE_TEST_ID = 'store-save';
export const SETTINGS_ERROR_TEST_ID = 'settings-error';
export const SETTINGS_LOAD_ERROR_TEST_ID = 'settings-load-error';
