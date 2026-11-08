import type { CacheRedisClient, CacheSetOptions } from '../../cache/redis-connection';

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

/** An in-memory {@link CacheRedisClient} that records every `SET` and `EXPIRE`, for the handler tests. */
export class FakeCacheRedis implements CacheRedisClient {
  readonly strings = new Map<string, string>();
  readonly sets = new Map<string, Set<string>>();
  readonly recordedSets: RecordedSet[] = [];
  readonly recordedExpires: RecordedExpire[] = [];

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.strings.get(key) ?? null);
  }

  set(key: string, value: string, options: CacheSetOptions): Promise<unknown> {
    this.strings.set(key, value);
    this.recordedSets.push({ key, options });
    return Promise.resolve('OK');
  }

  del(keys: string | string[]): Promise<number> {
    const removed = [keys].flat().filter((key) => this.strings.delete(key) || this.sets.delete(key));
    return Promise.resolve(removed.length);
  }

  sAdd(key: string, members: string | string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    [members].flat().forEach((member) => set.add(member));
    this.sets.set(key, set);
    return Promise.resolve(set.size);
  }

  sMembers(key: string): Promise<string[]> {
    return Promise.resolve([...(this.sets.get(key) ?? [])]);
  }

  mGet(keys: string[]): Promise<(string | null)[]> {
    return Promise.resolve(keys.map((key) => this.strings.get(key) ?? null));
  }

  expire(key: string, seconds: number): Promise<number> {
    this.recordedExpires.push({ key, seconds });
    return Promise.resolve(this.strings.has(key) || this.sets.has(key) ? 1 : 0);
  }
}
