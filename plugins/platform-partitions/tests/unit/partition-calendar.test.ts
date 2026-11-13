import { describe, expect, it } from 'vitest';
import {
  expiredPartitions,
  partitionName,
  partitionRange,
  plannedPartitions,
  scrubbableByAge,
} from '../../domain/partition-calendar';
import type { PartitionPolicy, PartitionRef } from '../../domain/policy';

const utc = (iso: string): Date => new Date(iso);
const dailyPolicy: PartitionPolicy = { table: 'probe', column: 'createdAt', interval: 'day', premake: 7, retain: 7 };
const monthlyPolicy: PartitionPolicy = {
  table: 'probe',
  column: 'createdAt',
  interval: 'month',
  premake: 3,
  retain: 24,
};

const refOf = (policy: PartitionPolicy, at: string): PartitionRef => {
  const { start, end } = partitionRange(policy.interval, utc(at));
  return { table: policy.table, name: partitionName(policy.table, policy.interval, start), start, end };
};

describe('partitionRange', () => {
  it.each([
    ['2027-01-31T23:59:59.999Z', '2027-01-31T00:00:00.000Z', '2027-02-01T00:00:00.000Z'],
    ['2027-12-31T12:00:00.000Z', '2027-12-31T00:00:00.000Z', '2028-01-01T00:00:00.000Z'],
    ['2028-02-29T00:00:00.000Z', '2028-02-29T00:00:00.000Z', '2028-03-01T00:00:00.000Z'],
    ['2028-02-28T23:00:00.000Z', '2028-02-28T00:00:00.000Z', '2028-02-29T00:00:00.000Z'],
  ])('puts %s in the UTC day %s to %s', (at, start, end) => {
    // Act
    const range = partitionRange('day', utc(at));

    // Assert
    expect(range).toEqual({ start: utc(start), end: utc(end) });
  });

  it.each([
    ['2027-01-31T23:59:59.999Z', '2027-01-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z'],
    ['2027-12-31T12:00:00.000Z', '2027-12-01T00:00:00.000Z', '2028-01-01T00:00:00.000Z'],
    ['2028-02-29T10:00:00.000Z', '2028-02-01T00:00:00.000Z', '2028-03-01T00:00:00.000Z'],
  ])('puts %s in the UTC month %s to %s', (at, start, end) => {
    // Act
    const range = partitionRange('month', utc(at));

    // Assert
    expect(range).toEqual({ start: utc(start), end: utc(end) });
  });
});

describe('partitionName', () => {
  it.each([
    ['day', '2027-01-31T00:00:00.000Z', 'probe_p20270131'],
    ['day', '2028-02-29T00:00:00.000Z', 'probe_p20280229'],
    ['month', '2027-12-01T00:00:00.000Z', 'probe_p202712'],
    ['month', '2028-02-01T00:00:00.000Z', 'probe_p202802'],
  ] as const)('names a %s partition starting %s as %s', (interval, start, name) => {
    // Act / Assert
    expect(partitionName('probe', interval, utc(start))).toBe(name);
  });
});

describe('plannedPartitions', () => {
  it('yields the current day plus premake days, contiguous', () => {
    // Act
    const planned = plannedPartitions(dailyPolicy, utc('2030-03-10T15:30:00.000Z'));

    // Assert
    expect(planned).toHaveLength(8);
    expect(planned.map((ref) => ref.name)).toEqual([
      'probe_p20300310',
      'probe_p20300311',
      'probe_p20300312',
      'probe_p20300313',
      'probe_p20300314',
      'probe_p20300315',
      'probe_p20300316',
      'probe_p20300317',
    ]);
    planned.slice(1).forEach((ref, index) => {
      expect(ref.start).toEqual(planned[index]?.end);
    });
    expect(planned.at(-1)?.end).toEqual(utc('2030-03-18T00:00:00.000Z'));
  });

  it('crosses a year end and a leap day', () => {
    // Act
    const planned = plannedPartitions({ ...dailyPolicy, premake: 2 }, utc('2027-12-31T00:00:00.000Z'));

    // Assert
    expect(planned.map((ref) => ref.name)).toEqual(['probe_p20271231', 'probe_p20280101', 'probe_p20280102']);
    expect(
      plannedPartitions({ ...dailyPolicy, premake: 1 }, utc('2028-02-28T00:00:00.000Z')).map((ref) => ref.name),
    ).toEqual(['probe_p20280228', 'probe_p20280229']);
  });

  it('yields the current month plus premake months', () => {
    // Act
    const planned = plannedPartitions(monthlyPolicy, utc('2030-11-20T00:00:00.000Z'));

    // Assert
    expect(planned.map((ref) => ref.name)).toEqual([
      'probe_p203011',
      'probe_p203012',
      'probe_p203101',
      'probe_p203102',
    ]);
  });
});

describe('expiredPartitions', () => {
  const existing = (policy: PartitionPolicy, days: string[]): PartitionRef[] => days.map((day) => refOf(policy, day));

  it('keeps the 7 previous days and the current one, and expires the older ones', () => {
    // Arrange
    const all = existing(dailyPolicy, [
      '2030-03-20',
      '2030-03-21',
      '2030-03-22',
      '2030-03-23',
      '2030-03-29',
      '2030-03-30',
    ]);

    // Act
    const expired = expiredPartitions(dailyPolicy, all, utc('2030-03-30T00:00:00.000Z'));

    // Assert
    expect(expired.map((ref) => ref.name)).toEqual(['probe_p20300320', 'probe_p20300321', 'probe_p20300322']);
  });

  it('expires a monthly partition once its upper bound is at or before the retention cut', () => {
    // Arrange
    const all = existing(monthlyPolicy, ['2028-10-05', '2028-11-05', '2028-12-05']);

    // Act (cut: 2030-12-01 minus 24 months = 2028-12-01)
    const expired = expiredPartitions(monthlyPolicy, all, utc('2030-12-15T00:00:00.000Z'));

    // Assert
    expect(expired.map((ref) => ref.name)).toEqual(['probe_p202810', 'probe_p202811']);
  });
});

describe('scrubbableByAge', () => {
  it('is empty for a policy without a scrub', () => {
    // Act / Assert
    expect(scrubbableByAge(dailyPolicy, [refOf(dailyPolicy, '2030-01-01')], utc('2030-03-30T00:00:00.000Z'))).toEqual(
      [],
    );
  });

  it('lists partitions older than the scrub age', () => {
    // Arrange
    const policy: PartitionPolicy = { ...dailyPolicy, scrub: { afterIntervals: 3, sql: (table) => `-- ${table}` } };
    const all = ['2030-03-24', '2030-03-26', '2030-03-27', '2030-03-29'].map((day) => refOf(policy, day));

    // Act (cut: 2030-03-30 minus 3 days = 2030-03-27)
    const scrubbable = scrubbableByAge(policy, all, utc('2030-03-30T08:00:00.000Z'));

    // Assert
    expect(scrubbable.map((ref) => ref.name)).toEqual(['probe_p20300324', 'probe_p20300326']);
  });
});
