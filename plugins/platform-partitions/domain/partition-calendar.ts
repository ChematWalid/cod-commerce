import { PARTITION_NAME_SEPARATOR } from './constants';
import type { PartitionInterval, PartitionPolicy, PartitionRef } from './policy';

const YEAR_DIGITS = 4;
const MONTH_OR_DAY_DIGITS = 2;

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/** The first instant of the UTC interval holding `at`. */
function startOf(interval: PartitionInterval, at: Date): Date {
  return interval === 'day'
    ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
    : new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

/** `start` moved by `count` whole intervals (negative: back); `start` must be an interval start. */
function shift(interval: PartitionInterval, start: Date, count: number): Date {
  return interval === 'day'
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + count))
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + count, 1));
}

/** The UTC range of the interval that holds `at`: `[start, end)`. */
export function partitionRange(interval: PartitionInterval, at: Date): { start: Date; end: Date } {
  const start = startOf(interval, at);
  return { start, end: shift(interval, start, 1) };
}

/** `{table}_p{yyyymmdd}` for a day and `{table}_p{yyyymm}` for a month (D106); `start` is the partition's lower bound. */
export function partitionName(table: string, interval: PartitionInterval, start: Date): string {
  const month = `${pad(start.getUTCFullYear(), YEAR_DIGITS)}${pad(start.getUTCMonth() + 1, MONTH_OR_DAY_DIGITS)}`;
  const date = interval === 'day' ? `${month}${pad(start.getUTCDate(), MONTH_OR_DAY_DIGITS)}` : month;
  return `${table}${PARTITION_NAME_SEPARATOR}${date}`;
}

function refAt(policy: PartitionPolicy, start: Date): PartitionRef {
  return {
    table: policy.table,
    name: partitionName(policy.table, policy.interval, start),
    start,
    end: shift(policy.interval, start, 1),
  };
}

/** The current interval and the `premake` after it, contiguous, in order. */
export function plannedPartitions(policy: PartitionPolicy, now: Date): PartitionRef[] {
  const first = startOf(policy.interval, now);
  return Array.from({ length: policy.premake + 1 }, (_, index) => refAt(policy, shift(policy.interval, first, index)));
}

/** The partitions whose upper bound is at or before the start of the current interval minus `intervals`. */
function olderThan(
  policy: PartitionPolicy,
  existing: readonly PartitionRef[],
  now: Date,
  intervals: number,
): PartitionRef[] {
  const cut = shift(policy.interval, startOf(policy.interval, now), -intervals).getTime();
  return existing.filter((partition) => partition.end.getTime() <= cut);
}

/** The partitions past retention: the current interval and the `retain` before it stay. */
export function expiredPartitions(
  policy: PartitionPolicy,
  existing: readonly PartitionRef[],
  now: Date,
): PartitionRef[] {
  return olderThan(policy, existing, now, policy.retain);
}

/** The partitions old enough for the policy's scrub; none when the policy has no scrub. */
export function scrubbableByAge(policy: PartitionPolicy, existing: readonly PartitionRef[], now: Date): PartitionRef[] {
  return policy.scrub === undefined ? [] : olderThan(policy, existing, now, policy.scrub.afterIntervals);
}
