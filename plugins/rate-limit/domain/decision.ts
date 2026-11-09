/** The answer to one `consume`. */
export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Whole seconds until a retry can succeed; 0 when allowed. */
  readonly retryAfterSeconds: number;
}

/** Whether a key is locked out, and for how much longer. */
export interface LockoutStatus {
  readonly locked: boolean;
  readonly retryAfterSeconds: number;
}

export const ALLOWED: RateLimitDecision = { allowed: true, retryAfterSeconds: 0 };
export const NOT_LOCKED: LockoutStatus = { locked: false, retryAfterSeconds: 0 };
