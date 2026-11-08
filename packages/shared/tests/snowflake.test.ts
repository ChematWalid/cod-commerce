import { describe, expect, it } from 'vitest';
import {
  ClockMovedBackwardsError,
  InvalidSnowflakeError,
  InvalidWorkerIdError,
  SNOWFLAKE_EPOCH_MS,
  SnowflakeGenerator,
  toSnowflake,
} from '../src/index';

const FIXED_MS = SNOWFLAKE_EPOCH_MS + 123_456_789;

/** A clock that returns the scripted values, then keeps returning the last one plus one per call. */
function scriptedClock(values: readonly number[]): () => number {
  let index = 0;
  let last = values[0] ?? 0;
  return () => {
    if (index < values.length) {
      last = values[index] as number;
      index += 1;
      return last;
    }
    last += 1;
    return last;
  };
}

describe('SnowflakeGenerator', () => {
  it('lays out 41 bits of time, 10 of worker and 12 of sequence', () => {
    // Arrange
    const generator = new SnowflakeGenerator(37, () => FIXED_MS);
    // Act
    const first = BigInt(generator.next());
    const second = BigInt(generator.next());
    // Assert
    expect(first >> 22n).toBe(BigInt(FIXED_MS - SNOWFLAKE_EPOCH_MS));
    expect((first >> 12n) & 0x3ffn).toBe(37n);
    expect(first & 0xfffn).toBe(0n);
    expect(second & 0xfffn).toBe(1n);
    expect(first >> 63n).toBe(0n);
  });

  it('produces strictly increasing ids over 10 000 calls', () => {
    // Arrange
    let now = FIXED_MS;
    const generator = new SnowflakeGenerator(1, () => {
      now += 1;
      return now;
    });
    // Act
    const ids = Array.from({ length: 10_000 }, () => BigInt(generator.next()));
    // Assert
    for (let i = 1; i < ids.length; i += 1) {
      expect(ids[i] as bigint).toBeGreaterThan(ids[i - 1] as bigint);
    }
  });

  it('is strictly increasing even when the clock does not advance', () => {
    const generator = new SnowflakeGenerator(1, () => FIXED_MS);
    const ids = Array.from({ length: 4_096 }, () => BigInt(generator.next()));
    expect(new Set(ids).size).toBe(4_096);
  });

  it('waits for the next millisecond when the sequence overflows', () => {
    // Arrange: clock stays on FIXED_MS for 4096 ids, then moves on after being polled.
    let calls = 0;
    const generator = new SnowflakeGenerator(0, () => {
      calls += 1;
      return calls <= 4_097 ? FIXED_MS : FIXED_MS + 1;
    });
    // Act
    const ids = Array.from({ length: 4_097 }, () => BigInt(generator.next()));
    // Assert
    const last = ids[4_096] as bigint;
    expect(last >> 22n).toBe(BigInt(FIXED_MS + 1 - SNOWFLAKE_EPOCH_MS));
    expect(last & 0xfffn).toBe(0n);
  });

  it('waits when the clock moves back by 3 ms', () => {
    // Arrange
    const generator = new SnowflakeGenerator(0, scriptedClock([FIXED_MS, FIXED_MS - 3]));
    const first = BigInt(generator.next());
    // Act
    const second = BigInt(generator.next());
    // Assert
    expect(second).toBeGreaterThan(first);
  });

  it('throws when the clock moves back by 6 ms', () => {
    const generator = new SnowflakeGenerator(0, scriptedClock([FIXED_MS, FIXED_MS - 6]));
    generator.next();
    expect(() => generator.next()).toThrow(ClockMovedBackwardsError);
  });

  it.each([-1, 1024, 1.5, Number.NaN])('rejects worker id %s', (workerId) => {
    expect(() => new SnowflakeGenerator(workerId)).toThrow(InvalidWorkerIdError);
  });
});

describe('toSnowflake', () => {
  it('accepts the largest 63-bit id', () => {
    expect(toSnowflake('9223372036854775807')).toBe('9223372036854775807');
  });

  it.each(['9223372036854775808', '0', '01', '1.5', '', '-1', '12a'])('rejects "%s"', (value) => {
    expect(() => toSnowflake(value)).toThrow(InvalidSnowflakeError);
  });

  it('survives a JSON round trip above 2^53 as a string', () => {
    // Arrange
    const id = new SnowflakeGenerator(1, () => SNOWFLAKE_EPOCH_MS + 400 * 86_400_000).next();
    expect(BigInt(id)).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));
    // Act
    const parsed = JSON.parse(JSON.stringify({ id })) as { id: string };
    // Assert
    expect(parsed.id).toBe(id);
    expect(toSnowflake(parsed.id)).toBe(id);
  });
});
