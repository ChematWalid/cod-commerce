import { JobReconciler } from '@cod/plugin-platform-jobs';
import { describe, expect, it, vi } from 'vitest';
import { IMPORTS_EXPORTS_QUEUE, JOB_ERROR_CODES } from '../../domain/constants';
import { ImportJobsReconcileSource } from '../../infrastructure/import-jobs.reconcile-source';
import { FakeJobs, type FakeJobRow, RecordingLogger } from '../fakes/fake-jobs';

const NOW = new Date('2026-11-15T12:00:00.000Z');
const minutesAgo = (minutes: number): Date => new Date(NOW.getTime() - minutes * 60_000);

const row = (overrides: Partial<FakeJobRow> & Pick<FakeJobRow, 'id' | 'status' | 'updatedAt'>): FakeJobRow => ({
  table: 'import',
  businessId: '11',
  storeId: '22',
  actorAdministratorId: 5,
  ...overrides,
});

/** The platform reconciler over the source, BullMQ holding no job at all (lost with Valkey). */
function reconcilerOver(rows: FakeJobRow[]) {
  const jobs = new FakeJobs(rows);
  const add = vi.fn(() => Promise.resolve());
  const presence = {
    stateOf: vi.fn(() => Promise.resolve('missing' as const)),
    dueAtOf: vi.fn(() => Promise.resolve(null)),
    remove: vi.fn(),
  };
  const reconciler = new JobReconciler({
    presence,
    queues: { add },
    clock: { now: () => NOW.getTime() },
    logger: new RecordingLogger(),
  });
  reconciler.registerSource(new ImportJobsReconcileSource({ scan: jobs, jobs, logger: new RecordingLogger() }));
  return { reconciler, jobs, add };
}

describe('ImportJobsReconcileSource (D2212)', () => {
  it('re-enqueues confirming rows older than 2 minutes', async () => {
    // Arrange
    const { reconciler, jobs, add } = reconcilerOver([
      row({ id: '7301', status: 'confirming', updatedAt: minutesAgo(3) }),
      row({ id: '7303', status: 'confirming', updatedAt: minutesAgo(1) }),
      row({ id: '7302', table: 'export', status: 'queued', updatedAt: minutesAgo(5) }),
      row({ id: '7304', status: 'previewed', updatedAt: minutesAgo(60) }),
    ]);

    // Act
    const result = await reconciler.reconcile(NOW);

    // Assert
    expect(result).toEqual({ reenqueued: 2, exhausted: 0 });
    expect(add.mock.calls).toEqual([
      [
        IMPORTS_EXPORTS_QUEUE,
        { jobId: 'cex-7302', kind: 'product-export', recordId: '7302', businessId: '11', storeId: '22' },
      ],
      [
        IMPORTS_EXPORTS_QUEUE,
        { jobId: 'cim-7301', kind: 'product-import', recordId: '7301', businessId: '11', storeId: '22' },
      ],
    ]);
    expect(jobs.touched.map((touch) => touch.ref)).toEqual([
      { table: 'export', id: '7302' },
      { table: 'import', id: '7301' },
    ]);
  });

  it('fails running rows older than 30 minutes', async () => {
    // Arrange
    const { reconciler, jobs, add } = reconcilerOver([
      row({ id: '7301', status: 'running', updatedAt: minutesAgo(31) }),
      row({ id: '7302', table: 'export', status: 'running', updatedAt: minutesAgo(10) }),
    ]);

    // Act
    const result = await reconciler.reconcile(NOW);

    // Assert
    expect(result).toEqual({ reenqueued: 0, exhausted: 1 });
    expect(add).not.toHaveBeenCalled();
    expect(jobs.failed).toEqual([
      {
        scope: { businessId: '11', storeId: '22' },
        ref: { table: 'import', id: '7301' },
        failure: { errorCode: JOB_ERROR_CODES.STALLED, at: NOW },
      },
    ]);
  });

  it('pages after the last row of the previous batch', async () => {
    // Arrange
    const jobs = new FakeJobs([]);
    const scan = vi.spyOn(jobs, 'dueJobs');
    const source = new ImportJobsReconcileSource({ scan: jobs, jobs, logger: new RecordingLogger() });
    const after = {
      queue: IMPORTS_EXPORTS_QUEUE,
      data: { jobId: 'cim-7301', kind: 'product-import', recordId: '7301', businessId: '11', storeId: '22' },
      attempts: 0,
      stuckSince: minutesAgo(3),
    } as const;

    // Act
    await source.findDue(NOW, 50, after);

    // Assert
    expect(scan).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 50,
        requeueBefore: minutesAgo(2),
        failBefore: minutesAgo(30),
        after: { updatedAt: minutesAgo(3), table: 'import', id: '7301' },
      }),
    );
  });
});
