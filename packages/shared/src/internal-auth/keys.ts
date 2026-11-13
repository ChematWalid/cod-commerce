/** One signing key of the internal HMAC. */
export interface InternalSigningKey {
  readonly kid: string;
  readonly secret: string;
}

/** `INTERNAL_HMAC_KEYS` cannot be read. The message names the entry by position and never holds a secret. */
export class InvalidInternalKeysError extends Error {
  constructor(reason: string) {
    super(`Invalid internal HMAC keys: ${reason}`);
    this.name = 'InvalidInternalKeysError';
  }
}

const MIN_SECRET_LENGTH = 32;
const KID = /^[a-z0-9-]{1,16}$/;

/**
 * Reads `kid:secret[,kid:secret]`. A kid is 1 to 16 characters of `[a-z0-9-]`, a secret at least 32 characters.
 *
 * @throws {InvalidInternalKeysError} for an empty list, a malformed entry, a short secret or a duplicate kid.
 */
export function parseInternalKeys(value: string): readonly InternalSigningKey[] {
  const entries = value.split(',').map((entry) => entry.trim());
  if (value.trim() === '') {
    throw new InvalidInternalKeysError('the list is empty');
  }
  const keys: InternalSigningKey[] = [];
  entries.forEach((entry, index) => {
    const position = index + 1;
    const separator = entry.indexOf(':');
    if (separator === -1) {
      throw new InvalidInternalKeysError(`entry ${String(position)} is not kid:secret`);
    }
    const kid = entry.slice(0, separator);
    const secret = entry.slice(separator + 1);
    if (!KID.test(kid)) {
      throw new InvalidInternalKeysError(
        `entry ${String(position)} has a kid that is not 1 to 16 characters of a-z, 0-9 and -`,
      );
    }
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new InvalidInternalKeysError(
        `the secret of kid ${kid} is shorter than ${String(MIN_SECRET_LENGTH)} characters`,
      );
    }
    if (keys.some((key) => key.kid === kid)) {
      throw new InvalidInternalKeysError(`kid ${kid} appears more than once`);
    }
    keys.push({ kid, secret });
  });
  return keys;
}
