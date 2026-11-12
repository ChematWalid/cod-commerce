import { AES_KEY_BYTES, KID_PATTERN } from '../domain/constants';
import type { KekRing } from '../domain/ports/envelope-cipher.port';

export type { KekRing };

/** `TENANT_SECRET_KEKS` or its active kid cannot be used. Messages name the entry by position and never hold a key. */
export class InvalidKekRingError extends Error {
  constructor(reason: string) {
    super(`Invalid tenant secret keys: ${reason}`);
    this.name = 'InvalidKekRingError';
  }
}

/** One entry of the list as written: its kid and its 64 hex characters. */
export interface KekEntry {
  readonly kid: string;
  readonly hex: string;
}

const HEX_KEY = new RegExp(`^[0-9a-fA-F]{${String(AES_KEY_BYTES * 2)}}$`);

/**
 * Reads `kid:<64 hex>[,kid:<64 hex>]`: a kid is 1 to 16 characters of `[a-z0-9-]`, a key 32 bytes in hex.
 *
 * @throws {InvalidKekRingError} for an empty list or entry, a malformed kid or key, or a repeated kid.
 */
export function parseKekEntries(keks: string): readonly KekEntry[] {
  if (keks.trim() === '') {
    throw new InvalidKekRingError('the list is empty');
  }
  const entries: KekEntry[] = [];
  keks.split(',').forEach((raw, index) => {
    const position = String(index + 1);
    const entry = raw.trim();
    const separator = entry.indexOf(':');
    if (separator === -1) {
      throw new InvalidKekRingError(`entry ${position} is not kid:key`);
    }
    const kid = entry.slice(0, separator);
    const hex = entry.slice(separator + 1);
    if (!KID_PATTERN.test(kid)) {
      throw new InvalidKekRingError(`entry ${position} has a kid that is not 1 to 16 characters of a-z, 0-9 and -`);
    }
    if (!HEX_KEY.test(hex)) {
      throw new InvalidKekRingError(`the key of entry ${position} is not ${String(AES_KEY_BYTES * 2)} hex characters`);
    }
    if (entries.some((existing) => existing.kid === kid)) {
      throw new InvalidKekRingError(`kid ${kid} appears more than once`);
    }
    entries.push({ kid, hex });
  });
  return entries;
}

/** The ring: keys held as bytes behind {@link KekRing.key}, which hands out copies. It prints as nothing. */
class ParsedKekRing implements KekRing {
  constructor(
    readonly activeKid: string,
    private readonly keys: ReadonlyMap<string, Buffer>,
  ) {}

  key(kid: string): Buffer {
    const key = this.keys.get(kid);
    if (key === undefined) {
      throw new InvalidKekRingError(`the ring holds no key with kid ${kid}`);
    }
    return Buffer.from(key);
  }

  toJSON(): string {
    return '[kek ring]';
  }

  toString(): string {
    return '[kek ring]';
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[kek ring]';
  }
}

/**
 * Builds the ring from the two settings.
 *
 * @throws {InvalidKekRingError} when the list is malformed or `activeKid` names no key in it.
 */
export function parseKekRing(keks: string, activeKid: string): KekRing {
  const entries = parseKekEntries(keks);
  if (!entries.some((entry) => entry.kid === activeKid)) {
    throw new InvalidKekRingError(`the active kid ${activeKid} is not one of the kids in the list`);
  }
  return new ParsedKekRing(activeKid, new Map(entries.map((entry) => [entry.kid, Buffer.from(entry.hex, 'hex')])));
}
