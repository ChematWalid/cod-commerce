/** One HMAC key of the quote tokens (ADR 0004, D2422). */
export interface QuoteKey {
  readonly kid: string;
  readonly secret: string;
}

/** `QUOTE_HMAC_KEYS` or its active kid cannot be read. The message names entries and kids, never a secret. */
export class InvalidQuoteKeysError extends Error {
  constructor(reason: string) {
    super(`Invalid quote HMAC keys: ${reason}`);
    this.name = 'InvalidQuoteKeysError';
  }
}

/** A secret shorter than this is refused: 32 characters is the floor `openssl rand -hex 32` clears with room. */
export const MIN_QUOTE_SECRET_LENGTH = 32;
const KID = /^[a-z0-9-]{1,16}$/;

/** One `kid:secret` entry, checked against the keys read before it. */
function parseEntry(entry: string, position: number, before: readonly QuoteKey[]): QuoteKey {
  const separator = entry.indexOf(':');
  if (separator === -1) {
    throw new InvalidQuoteKeysError(`entry ${String(position)} is not kid:secret`);
  }
  const kid = entry.slice(0, separator);
  const secret = entry.slice(separator + 1);
  if (!KID.test(kid)) {
    throw new InvalidQuoteKeysError(
      `entry ${String(position)} has a kid that is not 1 to 16 characters of a-z, 0-9 and -`,
    );
  }
  if (secret.length < MIN_QUOTE_SECRET_LENGTH) {
    throw new InvalidQuoteKeysError(
      `the secret of kid ${kid} is shorter than ${String(MIN_QUOTE_SECRET_LENGTH)} characters`,
    );
  }
  if (before.some((key) => key.kid === kid)) {
    throw new InvalidQuoteKeysError(`kid ${kid} appears more than once`);
  }
  return { kid, secret };
}

/**
 * Reads `kid:secret[,kid:secret]`, the format of `INTERNAL_HMAC_KEYS`. A kid is 1 to 16 characters of `[a-z0-9-]`,
 * a secret at least 32 characters.
 *
 * @throws {InvalidQuoteKeysError} for an empty list, a malformed entry, a short secret or a duplicate kid.
 */
export function parseQuoteKeys(value: string): readonly QuoteKey[] {
  if (value.trim() === '') {
    throw new InvalidQuoteKeysError('the list is empty');
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .reduce<readonly QuoteKey[]>((keys, entry, index) => [...keys, parseEntry(entry, index + 1, keys)], []);
}
