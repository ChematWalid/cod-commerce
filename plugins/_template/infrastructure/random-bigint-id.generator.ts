import { randomBytes } from 'node:crypto';
import { type NoteId, toNoteId } from '../domain/note';
import type { IdGeneratorPort } from '../domain/ports/id-generator.port';

/** A 64-bit draw; the sign bit is then cleared, which leaves a positive 63-bit value (a Postgres `bigint`). */
const ID_BYTES = 8;
const SIGN_BIT_CLEARED = (1n << 63n) - 1n;

/**
 * Stub — owner: P1.S1 (dated deviation 7, P0.S2b, 2026-11-08): a random positive 63-bit id. P1.S1 replaces it
 * with the time-ordered ADR 0003 snowflake generator behind the same port.
 */
export class RandomBigintIdGenerator implements IdGeneratorPort {
  /** A new random id from 1 to 2^63 − 1; never `0`. */
  next(): NoteId {
    let value = 0n;
    while (value === 0n) {
      value = randomBytes(ID_BYTES).readBigUInt64BE() & SIGN_BIT_CLEARED;
    }
    return toNoteId(value.toString());
  }
}
