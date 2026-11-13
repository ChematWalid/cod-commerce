import type { LimiterRedis } from '../../infrastructure/valkey-rate-limiter';

const VALKEY_DOWN = 'connect ECONNREFUSED 127.0.0.1:6380';
const PTTL_NO_KEY = -2;

/**
 * A Valkey client whose lockout store lives in a map and whose every command can be made to fail, so a test
 * can count what reaches "Valkey" and break it at an exact moment.
 */
export class ScriptedRedis {
  status = 'ready';
  failing = false;
  commands = 0;
  /** Lock key to its expiry, in the test clock's milliseconds. */
  private readonly locks = new Map<string, number>();

  constructor(private readonly now: () => number) {}

  on(): this {
    return this;
  }

  disconnect(): void {
    this.status = 'reconnecting';
  }

  rlTokenBucket(): Promise<[number, number, number]> {
    return this.run(() => [1, 0, 0]);
  }

  rlRefund(): Promise<number> {
    return this.run(() => 1);
  }

  rlLockout(lockKey: string, _levelKey: string, initial: number): Promise<number> {
    return this.run(() => {
      this.locks.set(lockKey, this.now() + initial * 1000);
      return initial;
    });
  }

  pttl(key: string): Promise<number> {
    return this.run(() => {
      const remaining = (this.locks.get(key) ?? 0) - this.now();
      return remaining > 0 ? remaining : PTTL_NO_KEY;
    });
  }

  del(...keys: string[]): Promise<number> {
    return this.run(() => keys.filter((key) => this.locks.delete(key)).length);
  }

  /** Drops a lock behind the limiter's back, as another process clearing it would. */
  forget(lockKey: string): void {
    this.locks.delete(lockKey);
  }

  asClient(): LimiterRedis {
    return this as unknown as LimiterRedis;
  }

  private run<T>(answer: () => T): Promise<T> {
    this.commands += 1;
    if (this.failing) {
      return Promise.reject(new Error(VALKEY_DOWN));
    }
    this.status = 'ready';
    return Promise.resolve(answer());
  }
}
