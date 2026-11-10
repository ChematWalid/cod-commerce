import { BREAKER_OPEN_MS } from './constants';

/** One provider account: the scope of a breaker. */
export interface BreakerKey {
  readonly provider: string;
  readonly accountId: string;
}

/** `half-open`: the next caller probes the provider. */
export type BreakerState = 'closed' | 'open' | 'half-open';

/**
 * Stops calling a provider account that keeps failing (D100): opens after 5 failures within 120 s, lets one
 * probe through 60 s later; the probe's success closes it, its failure opens it again.
 * Throws `CircuitOpenError` while open.
 */
export abstract class CircuitBreaker {
  /** Runs `work` unless the breaker of `key` is open; a rejection of `work` counts as a failure and is rethrown. */
  abstract withCircuitBreaker<T>(key: BreakerKey, work: () => Promise<T>): Promise<T>;

  /** The state of the breaker of `key` now. */
  abstract stateOf(key: BreakerKey): Promise<BreakerState>;
}

/** The state of a breaker opened at `openedAtMs` (undefined: never opened, or closed since). */
export function breakerStateAt(openedAtMs: number | undefined, nowMs: number): BreakerState {
  if (openedAtMs === undefined) return 'closed';
  return nowMs < openedAtMs + BREAKER_OPEN_MS ? 'open' : 'half-open';
}
