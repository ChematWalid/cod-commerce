/** The routes of the auth pages, below the dashboard base (`/dashboard`). */
export const REGISTER_PATH = '/register';
export const LOGIN_PATH = '/login';
export const HOME_PATH = '/';
export const VERIFY_EMAIL_PATH = '/verify-email';
export const CONFIRM_EMAIL_CHANGE_PATH = '/confirm-email-change';
export const OAUTH_COMPLETE_PATH = '/oauth-complete';
export const ACCOUNT_PROFILE_PATH = '/account/profile';
export const ACCOUNT_SECURITY_PATH = '/account/security';

/** The id of the provider that shows the verification banner above every authenticated page. */
export const VERIFY_BANNER_PROVIDER_ID = 'auth-verify-email-banner';

export const ACCOUNT_STATUS_QUERY_KEY = ['auth', 'account-status'] as const;
export const ACCOUNT_PROFILE_QUERY_KEY = ['auth', 'account-profile'] as const;
export const AUTH_PUBLIC_CONFIG_QUERY_KEY = ['auth', 'public-config'] as const;

export const OAUTH_TICKET_ENDPOINT = '/auth/oauth/ticket';

/** Where a provider button starts the OAuth redirect (D36). */
export const oauthStartPath = (provider: string): string => `/auth/oauth/${encodeURIComponent(provider)}/start`;

/** A provider's name as its own brand writes it; an unknown one is shown as the server sent it. */
export const oauthProviderLabel = (provider: string): string =>
  ({ google: 'Google', facebook: 'Facebook' })[provider] ?? provider;

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
export const INVALID_TICKET_MESSAGE_ID = 'auth.invalid-token';
export const SIGN_IN_AFTER_REGISTER_MESSAGE_ID = 'Your account was created. Please sign in.';

export const REGISTER_FORM_TEST_ID = 'register-wizard';
export const VERIFY_BANNER_TEST_ID = 'verify-email-banner';
