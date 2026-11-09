import type { PlatformLanguageCode, SubdomainReasonCode } from '@cod/shared';

/** The routes of the auth pages, below the dashboard base (`/dashboard`). */
export const REGISTER_PATH = '/register';
export const LOGIN_PATH = '/login';
export const HOME_PATH = '/';
export const VERIFY_EMAIL_PATH = '/verify-email';
export const CONFIRM_EMAIL_CHANGE_PATH = '/confirm-email-change';
export const ACCOUNT_PROFILE_PATH = '/account/profile';
export const ACCOUNT_SECURITY_PATH = '/account/security';

/** The sidebar section of the account pages (D38). */
export const ACCOUNT_NAV_SECTION_ID = 'account';
export const ACCOUNT_NAV_SECTION_ORDER = 900;

/** The id of the provider that shows the verification banner above every authenticated page. */
export const VERIFY_BANNER_PROVIDER_ID = 'auth-verify-email-banner';

export const ACCOUNT_STATUS_QUERY_KEY = ['auth', 'account-status'] as const;
export const ACCOUNT_PROFILE_QUERY_KEY = ['auth', 'account-profile'] as const;
export const AUTH_PUBLIC_CONFIG_QUERY_KEY = ['auth', 'public-config'] as const;

/** How long the subdomain field waits after the last keystroke before asking the server. */
export const SUBDOMAIN_DEBOUNCE_MS = 400;
/** Used when a `429` carries no readable `Retry-After`. */
export const SUBDOMAIN_RETRY_FALLBACK_SECONDS = 10;
export const SUBDOMAIN_AVAILABILITY_ENDPOINT = '/stores/subdomain-availability';
export const HTTP_TOO_MANY_REQUESTS = 429;
export const MS_PER_SECOND = 1000;

/** Where a provider button starts the OAuth redirect (D36). */
export const oauthStartPath = (provider: string): string => `/auth/oauth/${encodeURIComponent(provider)}/start`;

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

/** Store languages, labelled in their own language whatever the dashboard's language is. */
export const STORE_LANGUAGE_OPTIONS: readonly { readonly code: PlatformLanguageCode; readonly label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];
export const DEFAULT_STORE_LANGUAGE: PlatformLanguageCode = 'ar';

/** Languages the public pages are translated into. */
export const PUBLIC_PAGE_LANGUAGES: readonly { readonly code: string; readonly label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
];

/** What the file picker offers; the server decides from the file's content (Task 8). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

export const GENERIC_ERROR_MESSAGE_ID = 'Something went wrong. Please try again.';
export const REQUIRED_FIELD_MESSAGE_ID = 'This field is required';
export const INVALID_PHONE_MESSAGE_ID = 'Enter a valid phone number';
export const PASSWORDS_DIFFER_MESSAGE_ID = 'The two passwords do not match';
export const IMAGE_SAVE_FAILED_MESSAGE_ID = 'Your store was created, but the logo could not be saved';
export const SIGN_IN_AFTER_REGISTER_MESSAGE_ID = 'Your account was created. Please sign in.';

export const REGISTER_FORM_TEST_ID = 'register-wizard';
export const VERIFY_BANNER_TEST_ID = 'verify-email-banner';
