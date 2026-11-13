import { Redis } from 'ioredis';
import type { FlagClock, FlagLogger } from '../application/ports';
import {
  FLAG_INVALIDATE_CHANNEL_SUFFIX,
  FLAG_SNAPSHOT_KEY_SUFFIX,
  FLAG_VALKEY_COMMAND_TIMEOUT_MS,
  FLAG_VALKEY_ERROR_LOG_INTERVAL_MS,
  FLAG_VALKEY_TTL_SECONDS,
} from '../domain/constants';
import type { FlagCachePort } from '../domain/ports/flag-cache.port';
import type { FlagSnapshot } from '../domain/snapshot';

/** What {@link ValkeyFlagCache} needs. */
export interface ValkeyFlagCacheOptions {
  readonly redisUrl: string;
  /** `APP_ENV`: it starts the key and the channel, so environments sharing a Valkey never read each other's flags. */
  readonly appEnv: string;
  readonly clock: FlagClock;
  readonly logger: FlagLogger;
}

/** A client that fails fast (no offline queue, 250 ms command timeout) instead of holding a request on a dead Valkey. */
function connect(redisUrl: string, connectionName: string, withTimeout: boolean): Redis {
  return new Redis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectionName,
    ...(withTimeout ? { commandTimeout: FLAG_VALKEY_COMMAND_TIMEOUT_MS } : {}),
  });
}

/**
 * The shared snapshot (D116): the key `{APP_ENV}:flags:snapshot` with a 24 h life, and the channel
 * `{APP_ENV}:flags:invalidate` on which a committed change is announced. Two clients, because a subscribing connection
 * can run no other command. A Valkey fault never throws: reads answer `undefined`, writes `false`, and the fault is
 * logged at most every 30 s. The subscriber also announces itself after a reconnect, since notices sent while it was
 * away are lost.
 */
export class ValkeyFlagCache implements FlagCachePort {
  private readonly commands: Redis;
  private readonly subscriber: Redis;
  private readonly key: string;
  private readonly channel: string;
  private readonly listeners: (() => void)[] = [];
  private lastLoggedAtMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly options: ValkeyFlagCacheOptions) {
    this.key = `${options.appEnv}:${FLAG_SNAPSHOT_KEY_SUFFIX}`;
    this.channel = `${options.appEnv}:${FLAG_INVALIDATE_CHANNEL_SUFFIX}`;
    this.commands = connect(options.redisUrl, 'platform-flags', true);
    this.subscriber = connect(options.redisUrl, 'platform-flags-subscriber', false);
    for (const client of [this.commands, this.subscriber]) {
      client.on('error', (error: Error) => {
        this.report(error);
      });
    }
    this.subscriber.on('message', () => {
      this.notify();
    });
    this.subscriber.on('ready', () => {
      this.join();
    });
  }

  async read(): Promise<FlagSnapshot | undefined> {
    try {
      const raw = await this.commands.get(this.key);
      return raw === null ? undefined : (JSON.parse(raw) as FlagSnapshot);
    } catch (error: unknown) {
      this.report(error);
      return undefined;
    }
  }

  async write(snapshot: FlagSnapshot): Promise<boolean> {
    try {
      await this.commands.set(this.key, JSON.stringify(snapshot), 'EX', FLAG_VALKEY_TTL_SECONDS);
      return true;
    } catch (error: unknown) {
      this.report(error);
      return false;
    }
  }

  async invalidate(): Promise<boolean> {
    try {
      await this.commands.del(this.key);
      await this.commands.publish(this.channel, 'invalidate');
      return true;
    } catch (error: unknown) {
      this.report(error);
      return false;
    }
  }

  /** Calls `listener` for every change notice, and after each (re)connection of the subscriber. */
  subscribe(listener: () => void): void {
    this.listeners.push(listener);
  }

  /** Subscribes to the channel (again, after a reconnect) and says so, since notices sent in between are lost. */
  private join(): void {
    this.subscriber.subscribe(this.channel).then(
      () => {
        this.notify();
      },
      (error: unknown) => {
        this.report(error);
      },
    );
  }

  /** Resolves when the command client is connected, or after `timeoutMs`, whichever is first. */
  async whenReady(timeoutMs: number): Promise<void> {
    const ready = (client: Redis): Promise<void> =>
      client.status === 'ready'
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, timeoutMs);
            client.once('ready', () => {
              clearTimeout(timer);
              resolve();
            });
          });
    await Promise.all([ready(this.commands), ready(this.subscriber)]);
  }

  async close(): Promise<void> {
    await Promise.all(
      [this.commands, this.subscriber].map((client) =>
        client.quit().catch(() => {
          // Not connected: nothing to close gently.
          client.disconnect();
        }),
      ),
    );
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private report(error: unknown): void {
    const nowMs = this.options.clock.now();
    if (nowMs - this.lastLoggedAtMs < FLAG_VALKEY_ERROR_LOG_INTERVAL_MS) return;
    this.lastLoggedAtMs = nowMs;
    const reason = error instanceof Error ? error.message : 'unknown error';
    this.options.logger.error(`Valkey unavailable for feature flags, the database answers instead: ${reason}`);
  }
}
