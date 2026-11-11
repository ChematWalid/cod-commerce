import { LOCKOUT_MEMORY_SECONDS, MS_PER_SECOND } from '../domain/constants';
import type { LockoutStatus, RateLimitDecision } from '../domain/decision';
import { NOT_LOCKED } from '../domain/decision';
import { nextLockoutSeconds } from '../domain/lockout';
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from '../domain/policies';
import { type BucketState, idleExpiryMs, takeToken } from '../domain/token-bucket';

/** Most buckets and lockouts kept in memory; above it, idle ones go first and then the oldest. */
const DEFAULT_MAX_ENTRIES = 10_000;

interface StoredBucket {
  readonly state: BucketState;
  readonly expiresAtMs: number;
}

interface StoredLockout {
  readonly lockedUntilMs: number;
  readonly durationSeconds: number;
  readonly forgetAtMs: number;
}

/** Drops expired entries and then the oldest until at most `limit` remain. Maps iterate in insertion order. */
function prune<T extends { readonly expiresAtMs: number }>(
  entries: Map<string, T>,
  limit: number,
  nowMs: number,
): void {
  if (entries.size <= limit) {
    return;
  }
  for (const [key, entry] of entries) {
    if (entry.expiresAtMs <= nowMs) {
      entries.delete(key);
    }
  }
  for (const key of entries.keys()) {
    if (entries.size <= limit) {
      return;
    }
    entries.delete(key);
  }
}

/**
 * The limiter's memory-only form: the fallback while Valkey is unreachable (D31). Same policies and the same
 * token arithmetic as the Valkey script, but per process, so a deployment of N api processes allows up to
 * N times the limit during an outage.
 */
export class InProcessBucket {
  private readonly buckets = new Map<string, StoredBucket>();
  private readonly lockouts = new Map<string, StoredLockout & { readonly expiresAtMs: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {}

  /** Buckets and lockouts currently held. */
  get size(): number {
    return this.buckets.size + this.lockouts.size;
  }

  /** Takes one token from the bucket of `key` under `policy`. */
  consume(policy: RateLimitPolicyName, key: string): RateLimitDecision {
    const nowMs = this.now();
    const definition = RATE_LIMIT_POLICIES[policy];
    const bucketKey = `${policy}:${key}`;
    const { decision, state } = takeToken(this.buckets.get(bucketKey)?.state, definition, nowMs);
    // Re-inserted so that the map's order is the order of last use.
    this.buckets.delete(bucketKey);
    this.buckets.set(bucketKey, { state, expiresAtMs: nowMs + idleExpiryMs(definition) });
    prune(this.buckets, this.maxEntries, nowMs);
    return decision;
  }

  /** Locks `key` out for twice as long as its previous lockout, 60 s for the first. */
  lockout(key: string): LockoutStatus {
    const nowMs = this.now();
    const previous = this.lockouts.get(key);
    const remembered = previous !== undefined && previous.forgetAtMs > nowMs ? previous.durationSeconds : 0;
    const durationSeconds = nextLockoutSeconds(remembered);
    const lockedUntilMs = nowMs + durationSeconds * MS_PER_SECOND;
    const forgetAtMs = lockedUntilMs + LOCKOUT_MEMORY_SECONDS * MS_PER_SECOND;
    this.lockouts.delete(key);
    this.lockouts.set(key, { lockedUntilMs, durationSeconds, forgetAtMs, expiresAtMs: forgetAtMs });
    prune(this.lockouts, this.maxEntries, nowMs);
    return { locked: true, retryAfterSeconds: durationSeconds };
  }

  /**
   * Records a lockout decided elsewhere (in Valkey) that ends `remainingSeconds` from now, so it still holds
   * here if Valkey becomes unreachable. Never shortens a lockout this process already holds.
   */
  holdLockout(key: string, remainingSeconds: number): void {
    const nowMs = this.now();
    const previous = this.lockouts.get(key);
    const lockedUntilMs = Math.max(previous?.lockedUntilMs ?? 0, nowMs + remainingSeconds * MS_PER_SECOND);
    const forgetAtMs = lockedUntilMs + LOCKOUT_MEMORY_SECONDS * MS_PER_SECOND;
    const longest = Math.max(previous?.durationSeconds ?? 0, remainingSeconds);
    this.lockouts.delete(key);
    this.lockouts.set(key, { lockedUntilMs, durationSeconds: longest, forgetAtMs, expiresAtMs: forgetAtMs });
    prune(this.lockouts, this.maxEntries, nowMs);
  }

  /** Whether `key` is locked out now, and for how many more seconds. */
  isLocked(key: string): LockoutStatus {
    const lockout = this.lockouts.get(key);
    const remainingMs = (lockout?.lockedUntilMs ?? 0) - this.now();
    if (remainingMs <= 0) {
      return NOT_LOCKED;
    }
    return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / MS_PER_SECOND) };
  }

  /** Forgets the lockout and its history. */
  clearLockout(key: string): void {
    this.lockouts.delete(key);
  }
}
