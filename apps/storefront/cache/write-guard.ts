import { processCacheConfig } from './cache-config';
import {
  CACHE_ENTRY_MAX_BYTES,
  CACHE_MEMORY_GUARD_POLL_MS,
  CACHE_MEMORY_GUARD_RATIO,
  CACHE_WRITES_OFF_TTL_SECONDS,
} from './constants';
import { writesOffKey } from './keys';
import { type CacheRedisClient, type CacheWriteGate, logCacheEvent, logCacheWarning } from './redis-connection';

/** Whether a serialised entry is within {@link CACHE_ENTRY_MAX_BYTES} (UTF-8 bytes, not characters). */
export function fitsEntryLimit(serialized: string): boolean {
  return Buffer.byteLength(serialized, 'utf8') <= CACHE_ENTRY_MAX_BYTES;
}

/** One numeric field of an `INFO` reply (`name:value` lines), or `null` when it is absent. */
function infoField(info: string, name: string): number | null {
  const match = new RegExp(`^${name}:(\\d+)`, 'm').exec(info);
  return match?.[1] === undefined ? null : Number(match[1]);
}

/**
 * `used_memory / maxmemory` from an `INFO memory` reply.
 *
 * @returns `null` when `maxmemory` is 0 (unlimited) or a field is missing: there is no ratio to guard
 */
export function memoryUsageRatio(info: string): number | null {
  const used = infoField(info, 'used_memory');
  const max = infoField(info, 'maxmemory');
  if (used === null || max === null || max === 0) return null;
  return used / max;
}

/** What a {@link CacheWriteGuard} needs. */
export interface CacheWriteGuardOptions {
  /** Namespaces the shared switch, `{APP_ENV}:cache:writes-off`. */
  readonly appEnv: string;
  readonly now?: () => number;
}

/**
 * The writes-off switch of ADR 0006 D4. At most every {@link CACHE_MEMORY_GUARD_POLL_MS} it reads `INFO memory`
 * and the shared switch: at {@link CACHE_MEMORY_GUARD_RATIO} of `maxmemory` it turns writes off here and sets
 * the switch for every instance, with a TTL so it clears itself. Reads and revalidations are never gated.
 */
export class CacheWriteGuard implements CacheWriteGate {
  private readonly switchKey: string;
  private readonly now: () => number;
  private writesOff = false;
  private polledAt = Number.NEGATIVE_INFINITY;
  private polling: Promise<void> | null = null;

  constructor(options: CacheWriteGuardOptions) {
    this.switchKey = writesOffKey(options.appEnv);
    this.now = options.now ?? Date.now;
  }

  /** Whether entries may be written now; polls Valkey first when the last poll is older than the interval. */
  async allowsWrites(client: CacheRedisClient): Promise<boolean> {
    if (this.now() - this.polledAt >= CACHE_MEMORY_GUARD_POLL_MS) {
      this.polling ??= this.poll(client).finally(() => {
        this.polling = null;
      });
      await this.polling;
    }
    return !this.writesOff;
  }

  // A failed poll keeps the last state: the writes that follow fail (and are logged) on their own if Valkey is down.
  private async poll(client: CacheRedisClient): Promise<void> {
    this.polledAt = this.now();
    try {
      const [info, sharedSwitch] = await Promise.all([client.info('memory'), client.get(this.switchKey)]);
      const ratio = memoryUsageRatio(info);
      const full = ratio !== null && ratio >= CACHE_MEMORY_GUARD_RATIO;
      this.update(full || sharedSwitch !== null);
      if (full) {
        await client.set(this.switchKey, '1', { expiration: { type: 'EX', value: CACHE_WRITES_OFF_TTL_SECONDS } });
      }
    } catch (error) {
      logCacheWarning('write_guard_poll_failed', error);
    }
  }

  private update(writesOff: boolean): void {
    if (writesOff !== this.writesOff) logCacheEvent('writes_switched', { writesOff });
    this.writesOff = writesOff;
  }
}

let processGuard: CacheWriteGuard | null = null;

/** The one guard of this process, shared by both cache handlers. */
export function processCacheWriteGuard(): CacheWriteGuard {
  processGuard ??= new CacheWriteGuard({ appEnv: processCacheConfig().appEnv });
  return processGuard;
}
