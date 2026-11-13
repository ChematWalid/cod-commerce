import { createHash } from 'node:crypto';

const BUCKETS = 100;

/**
 * The business's place in line for a flag, 0 to 99 (D116): the first four bytes of `sha256("{key}:{businessId}")` as
 * an unsigned integer, modulo 100. Stable for one pair, and different per flag, so one business is not always first.
 */
export function rolloutBucket(key: string, businessId: string): number {
  return createHash('sha256').update(`${key}:${businessId}`).digest().readUInt32BE(0) % BUCKETS;
}
