import { DURABLE_JOB_KINDS, durableJobId, type QueueName, toBusinessId } from '@cod/shared';
import {
  OUTBOX_EXHAUSTED_ERROR,
  OUTBOX_RECONCILE_SOURCE,
  OUTBOX_SWEEP_AFTER_MS,
  OUTBOX_SWEEP_WINDOW_MS,
} from '../domain/constants';
import type { OutboxDeliveryKey } from '../domain/outbox-event';
import type { OutboxConsumerRegistry } from './consumer-registry';
import type { DueDeliveryRow, OutboxDueScanPort, OutboxEnvironment, OutboxPorts, OutboxScopesPort } from './ports';

/** One open delivery as the reconciler of `platform-jobs` takes it; the shape matches its `DueJob`. */
export interface DueDeliveryJob {
  readonly queue: QueueName;
  readonly data: {
    readonly jobId: string;
    readonly outboxId: string;
    readonly createdAt: string;
    readonly businessId: string;
    readonly consumer: string;
  };
  readonly attempts: number;
  readonly stuckSince: Date;
  readonly nextAttemptAt: Date | null;
}

const keyOf = (job: DueDeliveryJob): OutboxDeliveryKey => ({
  createdAt: new Date(job.data.createdAt),
  outboxId: job.data.outboxId,
  consumer: job.data.consumer,
});

const cursorOf = (job: DueDeliveryJob): DueDeliveryRow => ({
  createdAt: new Date(job.data.createdAt),
  outboxId: job.data.outboxId,
  consumer: job.data.consumer,
  businessId: job.data.businessId,
  attempts: job.attempts,
  stuckSince: job.stuckSince,
  nextAttemptAt: job.nextAttemptAt,
});

/**
 * The outbox's rows for the job reconciler (D105): every `pending` or `enqueued` delivery that has been quiet for a
 * minute. The reconciler decides from BullMQ what to do; this class finds the rows and records the outcome.
 */
export class OutboxReconcileSource {
  readonly name = OUTBOX_RECONCILE_SOURCE;

  constructor(
    private readonly scan: OutboxDueScanPort,
    private readonly ports: OutboxPorts,
    private readonly registry: OutboxConsumerRegistry,
    private readonly environment: OutboxEnvironment,
  ) {}

  async findDue(now: Date, limit: number, after?: DueDeliveryJob): Promise<readonly DueDeliveryJob[]> {
    const rows = await this.scan.dueDeliveries(
      new Date(now.getTime() - OUTBOX_SWEEP_WINDOW_MS),
      new Date(now.getTime() - OUTBOX_SWEEP_AFTER_MS),
      limit,
      after === undefined ? undefined : cursorOf(after),
    );
    const jobs: DueDeliveryJob[] = [];
    for (const row of rows) {
      const job = this.toJob(row);
      if (job !== null) jobs.push(job);
    }
    return jobs;
  }

  async markEnqueued(jobs: readonly DueDeliveryJob[], now: Date): Promise<void> {
    await this.perBusiness(jobs, (scope, job) => this.ports.store.markReenqueued(scope, keyOf(job), now));
  }

  async markExhausted(jobs: readonly DueDeliveryJob[], now: Date): Promise<void> {
    await this.perBusiness(jobs, (scope, job) =>
      this.ports.store.finishDelivery(scope, keyOf(job), { status: 'failed', lastError: OUTBOX_EXHAUSTED_ERROR }, now),
    );
    for (const job of jobs) {
      this.environment.logger.error(
        `Outbox delivery ${job.data.outboxId}:${job.data.consumer} of business ${job.data.businessId} failed: attempts exhausted`,
      );
    }
  }

  private toJob(row: DueDeliveryRow): DueDeliveryJob | null {
    let queue: QueueName;
    try {
      queue = this.registry.get(row.consumer).queue;
    } catch {
      this.environment.logger.warn(`Outbox delivery ${row.outboxId} names consumer ${row.consumer}, unknown here`);
      return null;
    }
    return {
      queue,
      data: {
        jobId: durableJobId(DURABLE_JOB_KINDS.outboxDelivery, row.outboxId, row.consumer),
        outboxId: row.outboxId,
        createdAt: row.createdAt.toISOString(),
        businessId: row.businessId,
        consumer: row.consumer,
      },
      attempts: row.attempts,
      stuckSince: row.stuckSince,
      nextAttemptAt: row.nextAttemptAt,
    };
  }

  private async perBusiness(
    jobs: readonly DueDeliveryJob[],
    apply: (scope: Parameters<Parameters<OutboxScopesPort['plain']>[1]>[0], job: DueDeliveryJob) => Promise<void>,
  ): Promise<void> {
    for (const job of jobs) {
      try {
        await this.ports.scopes.plain(toBusinessId(job.data.businessId), (scope) => apply(scope, job));
      } catch (error: unknown) {
        this.environment.logger.error(
          `Outbox delivery ${job.data.outboxId}:${job.data.consumer} of business ${job.data.businessId} could not be recorded: ${error instanceof Error ? error.name : typeof error}`,
        );
      }
    }
  }
}
