import { QUEUES } from '@cod/shared';
import type { PlatformClock } from '../domain/clock.port';
import { RECONCILE_BATCH_SIZE, RECONCILE_BUDGET_MS, RECONCILE_SLA_MS } from '../domain/constants';
import type { JobPresencePort } from '../domain/job-presence.port';
import type { DueJob, ReconcileLogger, ReconcileSource } from '../domain/reconcile-source';
import type { PlatformQueues } from './platform-queues';

/** What the reconciler works through. */
export interface JobReconcilerDeps {
  readonly presence: JobPresencePort;
  readonly queues: Pick<PlatformQueues, 'add'>;
  readonly clock: PlatformClock;
  readonly logger: ReconcileLogger;
}

/** What one run did. */
export interface ReconcileResult {
  readonly reenqueued: number;
  readonly exhausted: number;
}

type Verdict = 'skip' | 'exhausted' | 'add' | 'replace';

interface BatchOutcome {
  readonly readded: DueJob[];
  readonly exhausted: DueJob[];
}

/**
 * Makes sure every durable row that is not over has a job that will run it (D105). It asks BullMQ per row: no job
 * (lost with Valkey) is added at once; a settled job BullMQ still keeps would make an add with the same id a no-op, so
 * it is removed first; a live job is left alone until it is past its SLA. A row that used all its attempts and is past
 * due ends as failed instead of looping.
 */
export class JobReconciler {
  private readonly sources: ReconcileSource[] = [];

  constructor(private readonly deps: JobReconcilerDeps) {}

  /** Adds a table of durable rows to what each run looks at. */
  registerSource(source: ReconcileSource): void {
    this.sources.push(source);
  }

  /** One catch-up run as of `now`: batches until nothing changes, the batch is short, or the 40 s budget is spent. */
  async reconcile(now: Date): Promise<ReconcileResult> {
    const deadline = this.deps.clock.now() + RECONCILE_BUDGET_MS;
    let reenqueued = 0;
    let exhausted = 0;
    for (const source of this.sources) {
      for (;;) {
        const batch = await source.findDue(now, RECONCILE_BATCH_SIZE);
        const outcome = await this.process(source, batch, now);
        reenqueued += outcome.readded.length;
        exhausted += outcome.exhausted.length;
        const changed = outcome.readded.length + outcome.exhausted.length;
        if (batch.length < RECONCILE_BATCH_SIZE || changed === 0 || this.deps.clock.now() >= deadline) break;
      }
    }
    return { reenqueued, exhausted };
  }

  private async process(source: ReconcileSource, batch: readonly DueJob[], now: Date): Promise<BatchOutcome> {
    const readded: DueJob[] = [];
    const exhausted: DueJob[] = [];
    for (const job of batch) {
      try {
        const verdict = await this.verdictOf(job, now);
        if (verdict === 'exhausted') exhausted.push(job);
        else if (await this.requeue(job, verdict)) readded.push(job);
      } catch (error: unknown) {
        this.deps.logger.error(
          `Reconciler could not requeue ${job.data.jobId} of ${source.name}: ${error instanceof Error ? error.name : typeof error}`,
        );
      }
    }
    if (readded.length > 0) await source.markEnqueued(readded, now);
    if (exhausted.length > 0) await source.markExhausted(exhausted, now);
    return { readded, exhausted };
  }

  /** Adds the job again (after removing the settled one it replaces); false when it is left alone. */
  private async requeue(job: DueJob, verdict: Verdict): Promise<boolean> {
    if (verdict === 'skip') return false;
    if (verdict === 'replace') await this.deps.presence.remove(job.queue, job.data.jobId);
    await this.deps.queues.add(job.queue, job.data);
    return true;
  }

  private async verdictOf(job: DueJob, now: Date): Promise<Verdict> {
    const spec = QUEUES[job.queue];
    const dueAt = job.nextAttemptAt ?? new Date(job.stuckSince.getTime() + RECONCILE_SLA_MS[spec.pool]);
    const pastDue = dueAt.getTime() < now.getTime();
    if (job.attempts >= spec.attempts && pastDue) return 'exhausted';
    const presence = await this.deps.presence.stateOf(job.queue, job.data.jobId);
    if (presence === 'missing') return 'add';
    if (presence === 'failed' || presence === 'completed') return 'replace';
    return pastDue ? 'replace' : 'skip';
  }
}
