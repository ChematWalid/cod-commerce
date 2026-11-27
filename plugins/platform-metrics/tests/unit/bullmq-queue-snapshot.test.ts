import { describe, expect, it } from 'vitest';
import { QUEUE_SAMPLE_LIMIT } from '../../domain/constants';
import { snapshotOfQueue, type SnapshotQueue } from '../../infrastructure/bullmq-queue-snapshot';

type GetJobs = SnapshotQueue['getJobs'];

/** A BullMQ queue stand-in holding jobs by state. */
function fakeQueue(jobsByState: Record<string, { name: string; timestamp: number }[]>) {
  const calls: { types: unknown; start: unknown; end: unknown; asc: unknown }[] = [];
  const queue = {
    getJobCounts: (...types: string[]) =>
      Promise.resolve(Object.fromEntries(types.map((type) => [type, (jobsByState[type] ?? []).length * 10]))),
    getJobs: ((types: string[], start: number, end: number, asc: boolean) => {
      calls.push({ types, start, end, asc });
      return Promise.resolve(jobsByState[types[0] ?? ''] ?? []);
    }) as unknown as GetJobs,
  } as SnapshotQueue;
  return { queue, calls };
}

describe('snapshotOfQueue', () => {
  it('takes the exact counts per state and the job names of a bounded, oldest-first sample', async () => {
    // Arrange
    const { queue, calls } = fakeQueue({
      waiting: [{ name: 'dispatch', timestamp: 100 }],
      failed: [{ name: 'capi', timestamp: 50 }],
    });

    // Act
    const snapshot = await snapshotOfQueue(queue);

    // Assert
    expect(snapshot.counts).toEqual({ waiting: 10, active: 0, failed: 10, delayed: 0 });
    expect(snapshot.jobs).toEqual(
      expect.arrayContaining([
        { name: 'dispatch', state: 'waiting', enqueuedAtMs: 100 },
        { name: 'capi', state: 'failed', enqueuedAtMs: 50 },
      ]),
    );
    expect(calls.every((call) => call.start === 0 && call.end === QUEUE_SAMPLE_LIMIT - 1 && call.asc === true)).toBe(
      true,
    );
  });
});
