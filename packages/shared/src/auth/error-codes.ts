/** Stable error codes of the auth API; clients map them to translated messages. */
export const AUTH_ERROR_CODES = {
  EMAIL_TAKEN: 'auth.email-taken',
  EMAIL_INVALID: 'auth.email-invalid',
  INVALID_TOKEN: 'auth.invalid-token',
  OTP_INVALID: 'auth.otp-invalid',
  OTP_LOCKED: 'auth.otp-locked',
  PASSWORD_POLICY: 'auth.password-policy',
  REGISTRATION_INVALID: 'auth.registration-invalid',
  PROFILE_INVALID: 'auth.profile-invalid',
  CURRENT_PASSWORD_WRONG: 'auth.current-password-wrong',
  COOLDOWN: 'auth.cooldown',
  RATE_LIMITED: 'auth.rate-limited',
  CHALLENGE_FAILED: 'auth.challenge-failed',
  USE_ACCOUNT_SECURITY: 'auth.use-account-security',
  OAUTH_LINK_REQUIRES_VERIFICATION: 'auth.oauth-link-requires-verification',
  OAUTH_EMAIL_UNCONFIRMED: 'auth.oauth-email-unconfirmed',
  OAUTH_FAILED: 'auth.oauth-failed',
  LOGO_TOO_LARGE: 'auth.logo-too-large',
  LOGO_TYPE: 'auth.logo-type',
  IMAGE_TYPE: 'auth.image-type',
} as const;

/** One of the {@link AUTH_ERROR_CODES} values. */
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
