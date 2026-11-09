/** The answer to one `consume`. */
export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Whole seconds until a retry can succeed; 0 when allowed. */
  readonly retryAfterSeconds: number;
  /** No whole token is left after this call, so an immediate next `consume` would be refused. */
  readonly exhausted: boolean;
}

/** Whether a key is locked out, and for how much longer. */
export interface LockoutStatus {
  readonly locked: boolean;
  readonly retryAfterSeconds: number;
}

export const ALLOWED: RateLimitDecision = { allowed: true, retryAfterSeconds: 0, exhausted: false };
export const NOT_LOCKED: LockoutStatus = { locked: false, retryAfterSeconds: 0 };
