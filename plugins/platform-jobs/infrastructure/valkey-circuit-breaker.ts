import { randomUUID } from 'node:crypto';
import { type BreakerKey, type BreakerState, breakerStateAt, CircuitBreaker } from '../domain/breaker';
import type { PlatformClock } from '../domain/clock.port';
import {
  BREAKER_FAILURE_THRESHOLD,
  BREAKER_OPEN_MS,
  BREAKER_PROBE_LEASE_MS,
  BREAKER_RECORD_TTL_MS,
  BREAKER_WINDOW_MS,
} from '../domain/constants';
import { CircuitOpenError } from '../domain/errors';
import { ADMIT_CALL, ADMIT_PROBE, ADMIT_REJECT } from './breaker-scripts';
import type { PlatformValkey } from './valkey-client';

/** The probe token of a call made while the breaker was closed. */
const NOT_A_PROBE = '';

/** Options of {@link ValkeyCircuitBreaker}. */
export interface ValkeyBreakerOptions {
  /** `APP_ENV`, the first part of every key. */
  readonly appEnv: string;
  readonly clock: PlatformClock;
}

/** Valkey keys of one breaker: its record and its failure set. */
interface BreakerKeys {
  readonly record: string;
  readonly failures: string;
}

/** A breaker record at `{APP_ENV}:cb:{provider}:{accountId}` and its failures beside it, moved by scripts (D100). */
export class ValkeyCircuitBreaker extends CircuitBreaker {
  constructor(
    private readonly valkey: PlatformValkey,
    private readonly options: ValkeyBreakerOptions,
  ) {
    super();
  }

  async withCircuitBreaker<T>(key: BreakerKey, work: () => Promise<T>): Promise<T> {
    const keys = this.keysOf(key);
    const token = randomUUID();
    const admitted = await this.valkey.run((redis) =>
      redis.cbAdmit(keys.record, this.options.clock.now(), BREAKER_OPEN_MS, BREAKER_PROBE_LEASE_MS, token),
    );
    // `undefined`: Valkey is unavailable and the breaker fails open.
    const [decision, retryAfterMs] = admitted ?? [ADMIT_CALL, 0];
    if (decision === ADMIT_REJECT) throw new CircuitOpenError(retryAfterMs);
    const probeToken = decision === ADMIT_PROBE ? token : NOT_A_PROBE;
    let result: T;
    try {
      result = await work();
    } catch (error: unknown) {
      await this.recordFailure(keys, probeToken);
      throw error;
    }
    if (probeToken !== NOT_A_PROBE) {
      await this.valkey.runCleanup((redis) => redis.cbProbeSucceeded(keys.record, keys.failures, probeToken));
    }
    return result;
  }

  async stateOf(key: BreakerKey): Promise<BreakerState> {
    const openedAt = await this.valkey.run((redis) => redis.hget(this.keysOf(key).record, 'openedAt'));
    return breakerStateAt(
      openedAt === undefined || openedAt === null ? undefined : Number(openedAt),
      this.options.clock.now(),
    );
  }

  /** A probe's failure settles the probe lease, so it is sent even during the back-off; others are not. */
  private async recordFailure(keys: BreakerKeys, probeToken: string): Promise<void> {
    const send =
      probeToken === NOT_A_PROBE ? this.valkey.run.bind(this.valkey) : this.valkey.runCleanup.bind(this.valkey);
    await send((redis) =>
      redis.cbFailure(
        keys.record,
        keys.failures,
        this.options.clock.now(),
        probeToken,
        BREAKER_FAILURE_THRESHOLD,
        BREAKER_WINDOW_MS,
        randomUUID(),
        BREAKER_RECORD_TTL_MS,
      ),
    );
  }

  private keysOf(key: BreakerKey): BreakerKeys {
    const record = `${this.options.appEnv}:cb:${key.provider}:${key.accountId}`;
    return { record, failures: `${record}:failures` };
  }
}
