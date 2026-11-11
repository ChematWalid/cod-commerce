import { describe, expect, it } from 'vitest';
import { JobReconciler } from '../../application/job-reconciler';
import { RECONCILE_BATCH_SIZE } from '../../domain/constants';
import type { JobPresence } from '../../domain/job-presence.port';
import type { DueJob, ReconcileSource } from '../../domain/reconcile-source';
import { ManualClock } from '../fakes/manual-clock';

const NOW = new Date('2030-03-10T12:00:00Z');
const OLD = new Date('2030-03-10T11:00:00Z');

const jobOf = (id: string): DueJob => ({
  queue: 'order-effects',
  data: { jobId: id },
  attempts: 0,
  stuckSince: OLD,
});

function sourceOf(batches: DueJob[][]) {
  const marked: string[] = [];
  const source: ReconcileSource = {
    name: 'test',
    findDue: () => Promise.resolve(batches.shift() ?? []),
    markEnqueued: (jobs) => {
      marked.push(...jobs.map((job) => job.data.jobId));
      return Promise.resolve();
    },
    markExhausted: () => Promise.resolve(),
  };
  return { source, marked };
}

function reconcilerOf(presence: (id: string) => JobPresence, failAdd: (id: string) => boolean = () => false) {
  const added: string[] = [];
  const errors: string[] = [];
  const reconciler = new JobReconciler({
    presence: { stateOf: (_queue, id) => Promise.resolve(presence(id)), remove: () => Promise.resolve() },
    queues: {
      add: (_queue, data) => {
        if (failAdd(data.jobId)) return Promise.reject(new Error('secret=hunter2'));
        added.push(data.jobId);
        return Promise.resolve();
      },
    },
    clock: new ManualClock(),
    logger: { error: (message) => errors.push(message), warn: () => undefined },
  });
  return { reconciler, added, errors };
}

describe('JobReconciler', () => {
  it('keeps taking full batches while rows change, and stops at a short one', async () => {
    // Arrange
    const full = Array.from({ length: RECONCILE_BATCH_SIZE }, (_, index) => jobOf(`a${String(index)}`));
    const { source } = sourceOf([full, [jobOf('b1')]]);
    const { reconciler, added } = reconcilerOf(() => 'missing');
    reconciler.registerSource(source);

    // Act
    const result = await reconciler.reconcile(NOW);

    // Assert
    expect(result.reenqueued).toBe(RECONCILE_BATCH_SIZE + 1);
    expect(added).toHaveLength(RECONCILE_BATCH_SIZE + 1);
  });

  it('pages past a full batch of live rows to reach a lost job behind them', async () => {
    // Arrange
    const fresh = new Date(NOW.getTime() - 1000);
    const live = Array.from({ length: RECONCILE_BATCH_SIZE }, (_, index) => ({
      ...jobOf(`live${String(index)}`),
      stuckSince: fresh,
    }));
    const lost = jobOf('lost');
    const all = [...live, lost];
    const marked: string[] = [];
    const source: ReconcileSource = {
      name: 'test',
      findDue: (_now, limit, after) => {
        const start = after === undefined ? 0 : all.indexOf(after) + 1;
        return Promise.resolve(all.slice(start, start + limit));
      },
      markEnqueued: (jobs) => {
        marked.push(...jobs.map((job) => job.data.jobId));
        return Promise.resolve();
      },
      markExhausted: () => Promise.resolve(),
    };
    const { reconciler, added } = reconcilerOf((id) => (id === 'lost' ? 'missing' : 'live'));
    reconciler.registerSource(source);

    // Act
    const result = await reconciler.reconcile(NOW);

    // Assert
    expect(result).toEqual({ reenqueued: 1, exhausted: 0 });
    expect(added).toEqual(['lost']);
    expect(marked).toEqual(['lost']);
  });

  it('goes on to the next source when one source cannot mark its rows', async () => {
    // Arrange
    const { source: second, marked } = sourceOf([[jobOf('ok')]]);
    const broken: ReconcileSource = {
      name: 'broken',
      findDue: () => Promise.resolve([jobOf('x')]),
      markEnqueued: () => Promise.reject(new Error('secret=hunter2')),
      markExhausted: () => Promise.resolve(),
    };
    const { reconciler, errors } = reconcilerOf(() => 'missing');
    reconciler.registerSource(broken);
    reconciler.registerSource(second);

    // Act
    const result = await reconciler.reconcile(NOW);

    // Assert
    expect(marked).toEqual(['ok']);
    expect(result.reenqueued).toBe(2);
    expect(errors.some((message) => message.includes('broken'))).toBe(true);
    expect(errors.join(' ')).not.toContain('hunter2');
  });

  it('logs a row it cannot add without its error message, leaves it unmarked and goes on', async () => {
    // Arrange
    const { source, marked } = sourceOf([[jobOf('bad'), jobOf('good')]]);
    const { reconciler, added, errors } = reconcilerOf(
      () => 'missing',
      (id) => id === 'bad',
    );
    reconciler.registerSource(source);

    // Act
    const result = await reconciler.reconcile(NOW);

    // Assert
    expect(result.reenqueued).toBe(1);
    expect(added).toEqual(['good']);
    expect(marked).toEqual(['good']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).not.toContain('hunter2');
  });
});
