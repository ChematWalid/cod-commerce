import { LAST4_LENGTH, LAST4_MIN_CHARACTERS, SECRET_VALUE_MAX_BYTES } from './constants';
import { invalidValueSize } from './errors';

const REDACTED = '[redacted secret]';
const INSPECT = Symbol.for('nodejs.util.inspect.custom');

/**
 * A secret value that was accepted for storage. It prints, serialises and inspects as a fixed placeholder, so a log
 * line or an error that holds one by mistake shows nothing; the bytes leave only through {@link bytes}.
 */
export class SecretValue {
  private constructor(
    private readonly utf8: Buffer,
    /** The last four characters of a value of 12 characters or more, else `null`. */
    readonly last4: string | null,
  ) {}

  /**
   * Validates `raw`: 1 to 4 096 UTF-8 bytes, and well-formed text (a lone surrogate would not survive UTF-8).
   *
   * @throws {InvalidSecretValueError} otherwise; the message does not repeat the value.
   */
  static of(raw: string): SecretValue {
    const utf8 = Buffer.from(raw, 'utf8');
    // A lone surrogate becomes U+FFFD in UTF-8, so text that does not survive the round trip was not well-formed.
    if (utf8.length === 0 || utf8.length > SECRET_VALUE_MAX_BYTES || utf8.toString('utf8') !== raw) {
      throw invalidValueSize();
    }
    const characters = Array.from(raw);
    const last4 = characters.length >= LAST4_MIN_CHARACTERS ? characters.slice(-LAST4_LENGTH).join('') : null;
    return new SecretValue(utf8, last4);
  }

  /** A copy of the value's UTF-8 bytes; the caller zeroes it once used. */
  bytes(): Buffer {
    return Buffer.from(this.utf8);
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [INSPECT](): string {
    return REDACTED;
  }
}
