import type { CacheRedisClient, CacheRedisTransaction, CacheSetOptions } from '../../cache/redis-connection';

/** One `SET` the handler sent, with its options. */
export interface RecordedSet {
  readonly key: string;
  readonly options: CacheSetOptions;
}

/** One `EXPIRE` the handler sent. */
export interface RecordedExpire {
  readonly key: string;
  readonly seconds: number;
}

/** A `MULTI` block of the fake: commands are queued and applied together on `exec`. */
class FakeTransaction implements CacheRedisTransaction {
  private readonly queued: (() => void)[] = [];
  private readonly names: string[] = [];
  private readonly redis: FakeCacheRedis;

  constructor(redis: FakeCacheRedis) {
    this.redis = redis;
  }

  sAdd(key: string, members: string | string[]): CacheRedisTransaction {
    this.names.push(`sAdd ${key}`);
    this.queued.push(() => {
      const set = this.redis.sets.get(key) ?? new Set<string>();
      [members].flat().forEach((member) => set.add(member));
      this.redis.sets.set(key, set);
    });
    return this;
  }

  expire(key: string, seconds: number): CacheRedisTransaction {
    this.names.push(`expire ${key}`);
    this.queued.push(() => {
      this.redis.recordedExpires.push({ key, seconds });
    });
    return this;
  }

  exec(): Promise<unknown> {
    if (this.redis.failTransactions) return Promise.reject(new Error('fake EXECABORT'));
    this.queued.forEach((apply) => {
      apply();
    });
    this.redis.operations.push(`multi[${this.names.join(', ')}]`);
    return Promise.resolve(this.names.map(() => 'OK'));
  }
}

/**
 * An in-memory {@link CacheRedisClient} that records every `SET`, `EXPIRE` and transaction, in order, for the
 * handler tests. `failTransactions` makes every `MULTI` fail, like a dropped connection.
 */
export class FakeCacheRedis implements CacheRedisClient {
  readonly strings = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  readonly recordedSets: RecordedSet[] = [];
  readonly recordedExpires: RecordedExpire[] = [];
  /** `set <key>` and `multi[...]` in the order they reached the fake. */
  readonly operations: string[] = [];
  failTransactions = false;

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  set(key: string, value: string, options: CacheSetOptions): Promise<unknown> {
    this.strings.set(key, value);
    this.recordedSets.push({ key, options });
    this.operations.push(`set ${key}`);
    return Promise.resolve('OK');
  }

  del(keys: string | string[]): Promise<number> {
    const removed = [keys].flat().filter((key) => this.strings.delete(key) || this.sets.delete(key));
    return Promise.resolve(removed.length);
  }

  sMembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  mGet(keys: string[]): Promise<(string | null)[]> {
    return Promise.resolve(keys.map((key) => this.strings.get(key) ?? null));
  }

  multi(): CacheRedisTransaction {
    return new FakeTransaction(this);
  }
}
