import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { evaluateFlag } from '../../domain/evaluate';
import { rolloutBucket } from '../../domain/rollout';
import type { FlagSnapshot } from '../../domain/snapshot';

const KEY = 'capi.enabled';
const SAMPLE = 10_000;

/** Synthetic snowflake-like business ids. */
const businessIds = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => String(7_000_000_000_000_000_000n + BigInt(index) * 1_048_583n));

const snapshotWith = (rolloutPercent: number): FlagSnapshot => ({
  flags: {
    [KEY]: {
      description: 'rollout test',
      defaultEnabled: true,
      rolloutPercent,
      updatedAt: '2026-01-01T00:00:00.000Z',
      overrides: [],
    },
  },
});

describe('rolloutBucket', () => {
  it('is a stable integer from 0 to 99 for one business', () => {
    // Act
    const first = rolloutBucket(KEY, '7000000000000000001');
    const second = rolloutBucket(KEY, '7000000000000000001');

    // Assert
    expect(first).toBe(second);
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
  });

  it('is the first four bytes of sha256("key:businessId") as an unsigned integer, modulo 100 (D116)', () => {
    // Arrange
    const expected = (key: string, businessId: string): number =>
      createHash('sha256').update(`${key}:${businessId}`).digest().readUInt32BE(0) % 100;

    // Act and Assert
    for (const businessId of ['1', '7000000000000000001', '9223372036854775807']) {
      expect(rolloutBucket('a.b', businessId)).toBe(expected('a.b', businessId));
    }
  });

  it('differs per flag key, so one business is not always first in line', () => {
    // Act
    const buckets = new Set(
      ['a.enabled', 'b.enabled', 'c.enabled', 'd.enabled', 'e.enabled'].map((key) =>
        rolloutBucket(key, '7000000000000000001'),
      ),
    );

    // Assert
    expect(buckets.size).toBeGreaterThan(1);
  });
});

describe('rollout percent', () => {
  it('is off for every business at 0', () => {
    // Act
    const on = businessIds(500).filter((id) => evaluateFlag(snapshotWith(0), KEY, { businessId: id }, undefined));

    // Assert
    expect(on).toHaveLength(0);
  });

  it('is on for every business at 100', () => {
    // Act
    const on = businessIds(500).filter((id) => evaluateFlag(snapshotWith(100), KEY, { businessId: id }, undefined));

    // Assert
    expect(on).toHaveLength(500);
  });

  it('turns on between 25 % and 35 % of 10 000 businesses at 30', () => {
    // Act
    const on = businessIds(SAMPLE).filter((id) => evaluateFlag(snapshotWith(30), KEY, { businessId: id }, undefined));

    // Assert
    expect(on.length).toBeGreaterThan(SAMPLE * 0.25);
    expect(on.length).toBeLessThan(SAMPLE * 0.35);
  });

  it('keeps the answer for one business the same on every call, and a higher percent only adds businesses', () => {
    // Arrange
    const ids = businessIds(1000);
    const at = (percent: number): string[] =>
      ids.filter((id) => evaluateFlag(snapshotWith(percent), KEY, { businessId: id }, undefined));

    // Act
    const thirty = at(30);
    const again = at(30);
    const fifty = new Set(at(50));

    // Assert
    expect(again).toEqual(thirty);
    expect(thirty.every((id) => fifty.has(id))).toBe(true);
  });
});
