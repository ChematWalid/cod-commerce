import { describe, expect, it } from 'vitest';
import { PlatformGaugesService } from '../../application/platform-gauges.service';
import type { QueueSnapshot } from '../../domain/queue-gauges';
import { fakeSources, NOW, secondsAgo } from './fake-sources';

const valueOf = (
  readings: Awaited<ReturnType<PlatformGaugesService['read']>>,
  metric: string,
  attributes: Record<string, string> = {},
): number | undefined =>
  readings.find((r) => r.metric === metric && JSON.stringify(r.attributes) === JSON.stringify(attributes))?.value;

describe('PlatformGaugesService', () => {
  it('reports the outbox backlog through the outbox due scan', async () => {
    // Arrange
    const sources = fakeSources({
      outbox: { pendingSummary: () => Promise.resolve({ pending: 7, oldest: secondsAgo(125) }) },
    });

    // Act
    const readings = await new PlatformGaugesService(sources).read();

    // Assert
    expect(valueOf(readings, 'outbox_pending')).toBe(7);
    expect(valueOf(readings, 'outbox_oldest_age_seconds')).toBe(125);
  });

  it('reports an empty outbox as zero pending and zero age', async () => {
    // Arrange
    const sources = fakeSources();

    // Act
    const readings = await new PlatformGaugesService(sources).read();

    // Assert
    expect(valueOf(readings, 'outbox_pending')).toBe(0);
    expect(valueOf(readings, 'outbox_oldest_age_seconds')).toBe(0);
  });

  it('reports each scheduled task that succeeded once and leaves out one that never did', async () => {
    // Arrange
    const sources = fakeSources({
      tasks: {
        lastSuccess: () => Promise.resolve(new Map([['outbox-sweeper', secondsAgo(61)]])),
        scheduledTaskIds: () => ['outbox-sweeper', 'job-reconciler'],
      },
    });

    // Act
    const readings = await new PlatformGaugesService(sources).read();

    // Assert
    const tasks = readings.filter((r) => r.metric === 'scheduler_task_last_success_age_seconds');
    expect(tasks).toEqual([
      { metric: 'scheduler_task_last_success_age_seconds', value: 61, attributes: { task: 'outbox-sweeper' } },
    ]);
  });

  it('groups queue jobs by pool and job name, with exact pool totals', async () => {
    // Arrange
    const critical: QueueSnapshot = {
      counts: { waiting: 950, active: 3, failed: 1, delayed: 0 },
      jobs: [
        { name: 'dispatch', state: 'waiting', enqueuedAtMs: NOW - 30_000 },
        { name: 'dispatch', state: 'waiting', enqueuedAtMs: NOW - 10_000 },
        { name: 'notifications', state: 'active', enqueuedAtMs: NOW - 2_000 },
      ],
    };
    const sources = fakeSources({
      queues: {
        snapshotOf: (pool) =>
          Promise.resolve(
            pool === 'critical' ? critical : { ...critical, counts: { ...critical.counts, waiting: 0 }, jobs: [] },
          ),
      },
    });

    // Act
    const readings = await new PlatformGaugesService(sources).read();

    // Assert
    expect(valueOf(readings, 'queue_pool_jobs', { pool: 'critical', state: 'waiting' })).toBe(950);
    expect(valueOf(readings, 'queue_pool_jobs', { pool: 'bulk', state: 'waiting' })).toBe(0);
    expect(valueOf(readings, 'queue_jobs', { pool: 'critical', queue: 'dispatch', state: 'waiting' })).toBe(2);
    expect(valueOf(readings, 'queue_jobs', { pool: 'critical', queue: 'notifications', state: 'active' })).toBe(1);
    expect(valueOf(readings, 'queue_oldest_waiting_age_seconds', { pool: 'critical', queue: 'dispatch' })).toBe(30);
  });

  it('keeps the other gauges and logs the source when one read fails', async () => {
    // Arrange
    const sources = fakeSources({
      outbox: { pendingSummary: () => Promise.reject(new Error('database down')) },
      tasks: {
        lastSuccess: () => Promise.resolve(new Map([['outbox-sweeper', secondsAgo(5)]])),
        scheduledTaskIds: () => ['outbox-sweeper'],
      },
    });

    // Act
    const readings = await new PlatformGaugesService(sources).read();

    // Assert
    expect(valueOf(readings, 'outbox_pending')).toBeUndefined();
    expect(valueOf(readings, 'scheduler_task_last_success_age_seconds', { task: 'outbox-sweeper' })).toBe(5);
    expect(sources.errors).toEqual([expect.stringContaining('outbox backlog gauges')]);
    expect(sources.errors[0]).toContain('database down');
  });

  it('reports the intake spool as empty until the spool exists (P3.S4)', async () => {
    // Arrange
    const sources = fakeSources();

    // Act
    const readings = await new PlatformGaugesService(sources).read();

    // Assert
    expect(valueOf(readings, 'intake_spool_length')).toBe(0);
  });
});
