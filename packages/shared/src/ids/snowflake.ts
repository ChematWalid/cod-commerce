import { DomainError } from '../errors/domain-error';

/** An id of one of our entities: a positive 63-bit integer in decimal form, always a string outside the DB (ADR 0003). */
export type Snowflake = string & { readonly __brand: 'Snowflake' };

/** Start of the id timeline: 2025-01-01T00:00:00Z. */
const EPOCH_YEAR = 2025;
export const SNOWFLAKE_EPOCH_MS = Date.UTC(EPOCH_YEAR, 0, 1);

/** Largest valid id: 2^63 − 1, the maximum of a Postgres `bigint`. */
export const MAX_SNOWFLAKE = 9223372036854775807n;

const WORKER_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_WORKER_ID = (1 << Number(WORKER_BITS)) - 1;

/** The highest worker id a process leases from Valkey (ADR 0003). */
export const LEASED_WORKER_ID_MAX = 999;

/** The first worker id reserved for tests and scripts (ADR 0003). */
export const RESERVED_WORKER_ID_MIN = 1000;

/** The last worker id reserved for tests and scripts (ADR 0003). */
export const RESERVED_WORKER_ID_MAX = 1023;
const MAX_SEQUENCE = (1 << Number(SEQUENCE_BITS)) - 1;
/** A clock that steps back by up to this many ms is waited out; more is an error. */
export const MAX_CLOCK_BACKWARD_WAIT_MS = 5;

const SNOWFLAKE_FORMAT = /^[1-9][0-9]{0,18}$/;

/** Thrown when a value is not a valid {@link Snowflake}. */
export class InvalidSnowflakeError extends DomainError {
  readonly code = 'ids.invalid-snowflake';

  constructor(value: string) {
    super(`Invalid snowflake id: "${value}"`);
  }
}

/** Thrown when a generator is given a worker id outside 0..1023. */
export class InvalidWorkerIdError extends DomainError {
  readonly code = 'ids.invalid-worker-id';

  constructor(workerId: number) {
    super(`Invalid snowflake worker id: ${String(workerId)}`);
  }
}

/** Thrown when the clock moved back by more than {@link MAX_CLOCK_BACKWARD_WAIT_MS}. */
export class ClockMovedBackwardsError extends DomainError {
  readonly code = 'ids.clock-moved-backwards';

  constructor(backwardMs: number) {
    super(`Clock moved backwards by ${String(backwardMs)} ms; refusing to generate ids`);
  }
}

/**
 * Validates and brands a snowflake id.
 *
 * @throws {@link InvalidSnowflakeError} unless `value` is a decimal integer from 1 to {@link MAX_SNOWFLAKE}
 * without leading zeros.
 */
export function toSnowflake(value: string): Snowflake {
  if (!SNOWFLAKE_FORMAT.test(value) || BigInt(value) > MAX_SNOWFLAKE) {
    throw new InvalidSnowflakeError(value);
  }
  return value as Snowflake;
}

/**
 * Generates ids made of 41 bits of milliseconds since {@link SNOWFLAKE_EPOCH_MS}, 10 bits of worker id and
 * 12 bits of sequence (4 096 ids per millisecond per worker). One instance per worker id.
 */
export class SnowflakeGenerator {
  private readonly workerId: number;
  private readonly now: () => number;
  private lastMs = -1;
  private sequence = 0;

  constructor(workerId: number, now: () => number = Date.now) {
    this.workerId = workerId;
    this.now = now;
    if (!Number.isInteger(workerId) || workerId < 0 || workerId > MAX_WORKER_ID) {
      throw new InvalidWorkerIdError(workerId);
    }
  }

  /**
   * Returns the next id, strictly greater than every id this instance returned before.
   *
   * @throws {@link ClockMovedBackwardsError} when the clock is more than 5 ms behind the last id
   */
  next(): Snowflake {
    let ms = this.now();
    if (ms < this.lastMs) {
      ms = this.waitUntil(this.lastMs, this.lastMs - ms);
    }
    if (ms === this.lastMs) {
      this.sequence = (this.sequence + 1) & MAX_SEQUENCE;
      if (this.sequence === 0) {
        ms = this.waitUntil(this.lastMs + 1, 0);
      }
    } else {
      this.sequence = 0;
    }
    this.lastMs = ms;
    return this.compose(ms);
  }

  private waitUntil(target: number, backwardMs: number): number {
    if (backwardMs > MAX_CLOCK_BACKWARD_WAIT_MS) {
      throw new ClockMovedBackwardsError(backwardMs);
    }
    let ms = this.now();
    while (ms < target) {
      ms = this.now();
    }
    return ms;
  }

  private compose(ms: number): Snowflake {
    const elapsed = BigInt(ms - SNOWFLAKE_EPOCH_MS);
    const id =
      (elapsed << (WORKER_BITS + SEQUENCE_BITS)) | (BigInt(this.workerId) << SEQUENCE_BITS) | BigInt(this.sequence);
    return id.toString() as Snowflake;
  }
}
