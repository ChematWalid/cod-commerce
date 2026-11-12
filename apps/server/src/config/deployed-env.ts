import type { z } from 'zod';

/** Placeholder secrets in `.env.example` carry this marker, or are all zeros where the value is hex. */
export const PLACEHOLDER_SECRET_MARKER = 'change-me';

const ZERO_HEX_PLACEHOLDER = /^(GK)?0+$/;

/** True for a value taken from `.env.example`: it has the marker, or its hex part is all zeros. */
export function isPlaceholderSecret(value: string): boolean {
  return value.includes(PLACEHOLDER_SECRET_MARKER) || ZERO_HEX_PLACEHOLDER.test(value);
}

/**
 * A deployed secret needs at least this many different characters. One repeated character (`aaaa...`) or a short
 * pattern repeated (`abcabc...`) passes a length check yet has next to no entropy. Ten is below the 16 symbols
 * of a hex key, so every real generated secret passes, and above the handful of a keyboard-mash or a repeated word.
 */
export const MIN_DISTINCT_SECRET_CHARACTERS = 10;

/** The deployed minimum of a password a person types; the schema's own minimum (8) stays for development. */
export const MIN_DEPLOYED_PASSWORD_LENGTH = 12;

/**
 * The secrets that get the strength check, with their extra deployed minimum length where the schema's own is
 * lower. The other secrets (S3 key id, database and SMTP passwords, OAuth and Turnstile secrets) are issued by a
 * third party, so their shape is not ours to judge.
 */
const STRENGTH_CHECKED_SECRETS: Readonly<Record<string, number | undefined>> = {
  COOKIE_SECRET: undefined,
  AUTH_TOKEN_SECRET: undefined,
  SUPERADMIN_PASSWORD: MIN_DEPLOYED_PASSWORD_LENGTH,
  S3_SECRET_KEY: undefined,
  INTERNAL_HMAC_KEYS: undefined,
  TENANT_SECRET_KEKS: undefined,
};

/** The last label of a name that RFC 2606 and RFC 6761 reserve: it never resolves on the public internet. */
export const RESERVED_TLDS: readonly string[] = ['invalid', 'test', 'example', 'localhost', 'local'];

/** True when `domain` ends in a reserved label. */
export const hasReservedTld = (domain: string): boolean => RESERVED_TLDS.includes(domain.split('.').pop() ?? '');

/**
 * Reports a secret that is too short or too uniform. A placeholder is left to the placeholder check, so one value
 * never raises two issues. Messages name the variable, never the value.
 */
export function rejectWeakSecrets(
  secrets: readonly (readonly [name: string, value: string | undefined])[],
  context: z.RefinementCtx,
): void {
  for (const [name, value] of secrets) {
    if (value === undefined || !(name in STRENGTH_CHECKED_SECRETS) || isPlaceholderSecret(value)) {
      continue;
    }
    const minLength = STRENGTH_CHECKED_SECRETS[name];
    if (minLength !== undefined && value.length < minLength) {
      context.addIssue({
        code: 'custom',
        path: [name],
        message: `must be at least ${String(minLength)} characters in this environment`,
      });
    } else if (new Set(value).size < MIN_DISTINCT_SECRET_CHARACTERS) {
      context.addIssue({
        code: 'custom',
        path: [name],
        message: `is too uniform: use at least ${String(MIN_DISTINCT_SECRET_CHARACTERS)} different characters`,
      });
    }
  }
}
