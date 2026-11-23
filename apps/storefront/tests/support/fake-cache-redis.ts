import type {
  CacheRedisClient,
  CacheRedisTransaction,
  CacheSetOptions,
  SortedSetMember,
} from '../../cache/redis-connection';

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

/** `INFO memory` of a Valkey with plenty of room: 1 MB used of 100 MB. */
const ROOMY_MEMORY_INFO = '# Memory\r\nused_memory:1048576\r\nmaxmemory:104857600\r\n';

const scoreBound = (bound: number | string): number => (bound === '-inf' ? -Infinity : Number(bound));

/** A `MULTI` block of the fake: commands are queued and applied together on `exec`. */
class FakeTransaction implements CacheRedisTransaction {
  private readonly queued: (() => void)[] = [];
  private readonly names: string[] = [];
  private readonly redis: FakeCacheRedis;

  constructor(redis: FakeCacheRedis) {
    this.redis = redis;
  }

  private queue(name: string, apply: () => void): CacheRedisTransaction {
    this.names.push(name);
    this.queued.push(apply);
    return this;
  }

  zAdd(key: string, member: SortedSetMember): CacheRedisTransaction {
    return this.queue(`zAdd ${key}`, () => {
      this.redis.zAddNow(key, member);
    });
  }

  zRemRangeByScore(key: string, min: number | string, max: number | string): CacheRedisTransaction {
    return this.queue(`zRemRangeByScore ${key}`, () => {
      this.redis.zRemRangeByScoreNow(key, min, max);
    });
  }

  zRem(key: string, members: string | string[]): CacheRedisTransaction {
    return this.queue(`zRem ${key}`, () => {
      [members].flat().forEach((member) => this.redis.sortedSets.get(key)?.delete(member));
    });
  }

  del(keys: string | string[]): CacheRedisTransaction {
    return this.queue(`del ${[keys].flat().join(' ')}`, () => {
      this.redis.deleteNow(keys);
    });
  }

  expire(key: string, seconds: number): CacheRedisTransaction {
    return this.queue(`expire ${key}`, () => {
      this.redis.recordedExpires.push({ key, seconds });
    });
  }

  exec(): Promise<unknown> {
    if (this.redis.hang) return this.redis.never();
    if (this.redis.failTransactions) return Promise.reject(new Error('fake EXECABORT'));
    this.queued.forEach((apply) => {
      apply();
    });
    this.redis.operations.push(`multi[${this.names.join(', ')}]`);
    return Promise.resolve(this.names.map(() => 'OK'));
  }
}

/**
 * An in-memory {@link CacheRedisClient} that records every `SET`, `DEL`, `EXPIRE` and transaction, in order,
 * for the handler tests. `failTransactions` makes every `MULTI` fail, like a dropped connection; `hang` makes
 * every command never answer, like a stalled Valkey; `memoryInfo` is what `INFO memory` answers.
 */
export class FakeCacheRedis implements CacheRedisClient {
  readonly strings = new Map<string, string>();
  readonly sortedSets = new Map<string, Map<string, number>>();
  readonly recordedSets: RecordedSet[] = [];
  readonly recordedExpires: RecordedExpire[] = [];
  /** `set <key>`, `del <keys>` and `multi[...]` in the order they reached the fake. */
  readonly operations: string[] = [];
  failTransactions = false;
  hang = false;
  memoryInfo = ROOMY_MEMORY_INFO;

  /** A promise that never settles, for {@link hang}. */
  never<T>(): Promise<T> {
    return new Promise<T>(() => undefined);
  }

  private answer<T>(value: T): Promise<T> {
    return this.hang ? this.never() : Promise.resolve(value);
  }

  /** The members of a sorted set, lowest score first. */
  members(key: string): string[] {
    return [...(this.sortedSets.get(key) ?? new Map<string, number>()).entries()]
      .sort(([, a], [, b]) => a - b)
      .map(([member]) => member);
  }

  zAddNow(key: string, { score, value }: SortedSetMember): void {
    const set = this.sortedSets.get(key) ?? new Map<string, number>();
    set.set(value, score);
    this.sortedSets.set(key, set);
  }

  zRemRangeByScoreNow(key: string, min: number | string, max: number | string): void {
    const set = this.sortedSets.get(key);
    if (!set) return;
    for (const [member, score] of set) {
      if (score >= scoreBound(min) && score <= scoreBound(max)) set.delete(member);
    }
  }

  deleteNow(keys: string | string[]): number {
    return [keys].flat().filter((key) => this.strings.delete(key) || this.sortedSets.delete(key)).length;
  }

  get(key: string): Promise<string | null> {
    return this.answer(this.strings.get(key) ?? null);
  }

  set(key: string, value: string, options: CacheSetOptions): Promise<unknown> {
    if (this.hang) return this.never();
    this.strings.set(key, value);
    this.recordedSets.push({ key, options });
    this.operations.push(`set ${key}`);
    return Promise.resolve('OK');
  }

  del(keys: string | string[]): Promise<number> {
    if (this.hang) return this.never();
    this.operations.push(`del ${[keys].flat().join(' ')}`);
    return Promise.resolve(this.deleteNow(keys));
  }

  zRange(key: string, start: number, stop: number): Promise<string[]> {
    const members = this.members(key);
    return this.answer(members.slice(start, stop === -1 ? undefined : stop + 1));
  }

  mGet(keys: string[]): Promise<(string | null)[]> {
    return this.answer(keys.map((key) => this.strings.get(key) ?? null));
  }

  info(section: string): Promise<string> {
    return this.answer(section === 'memory' ? this.memoryInfo : '');
  }

  multi(): CacheRedisTransaction {
    return new FakeTransaction(this);
  }
}
