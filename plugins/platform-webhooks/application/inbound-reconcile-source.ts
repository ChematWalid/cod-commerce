import { DURABLE_JOB_KINDS, durableJobId, toBusinessId } from '@cod/shared';
import {
  INBOUND_EXHAUSTED_ERROR,
  INBOUND_QUIET_MS,
  INBOUND_RECONCILE_SOURCE,
  INBOUND_RECONCILE_WINDOW_MS,
  INBOUND_WEBHOOKS_QUEUE,
} from '../domain/constants';
import type { DueInboundRow, InboundDueScanPort, InboundEnvironment, InboundPorts, InboundScopesPort } from './ports';

/** One open webhook as the reconciler of `platform-jobs` takes it; the shape matches its `DueJob`. */
export interface DueInboundJob {
  readonly queue: typeof INBOUND_WEBHOOKS_QUEUE;
  readonly data: {
    readonly jobId: string;
    readonly inboundId: string;
    readonly receivedAt: string;
    readonly businessId: string;
  };
  readonly attempts: number;
  readonly stuckSince: Date;
}

const keyOf = (job: DueInboundJob) => ({ id: job.data.inboundId, receivedAt: new Date(job.data.receivedAt) });

const cursorOf = (job: DueInboundJob): DueInboundRow => ({
  id: job.data.inboundId,
  receivedAt: new Date(job.data.receivedAt),
  businessId: job.data.businessId,
  attempts: job.attempts,
  stuckSince: job.stuckSince,
});

const toJob = (row: DueInboundRow): DueInboundJob => ({
  queue: INBOUND_WEBHOOKS_QUEUE,
  data: {
    jobId: durableJobId(DURABLE_JOB_KINDS.inboundWebhook, row.id),
    inboundId: row.id,
    receivedAt: row.receivedAt.toISOString(),
    businessId: row.businessId,
  },
  attempts: row.attempts,
  stuckSince: row.stuckSince,
});

/**
 * The gateway's rows for the job reconciler (D105): every `received` webhook that has been quiet for a minute. The
 * reconciler decides from BullMQ what to do (missing job: add at once; live job: after the 5-minute SLA); this class
 * finds the rows and records the outcome.
 */
export class InboundReconcileSource {
  readonly name = INBOUND_RECONCILE_SOURCE;

  constructor(
    private readonly scan: InboundDueScanPort,
    private readonly ports: InboundPorts,
    private readonly environment: InboundEnvironment,
  ) {}

  async findDue(now: Date, limit: number, after?: DueInboundJob): Promise<readonly DueInboundJob[]> {
    const rows = await this.scan.dueWebhooks(
      new Date(now.getTime() - INBOUND_RECONCILE_WINDOW_MS),
      new Date(now.getTime() - INBOUND_QUIET_MS),
      limit,
      after === undefined ? undefined : cursorOf(after),
    );
    return rows.map(toJob);
  }

  async markEnqueued(jobs: readonly DueInboundJob[], now: Date): Promise<void> {
    await this.perBusiness(jobs, (scope, job) => this.ports.store.markReenqueued(scope, keyOf(job), now));
  }

  async markExhausted(jobs: readonly DueInboundJob[], now: Date): Promise<void> {
    await this.perBusiness(jobs, (scope, job) =>
      this.ports.store.finish(scope, keyOf(job), { status: 'failed', lastError: INBOUND_EXHAUSTED_ERROR }, now),
    );
    for (const job of jobs) {
      this.environment.logger.error(
        `Inbound webhook ${job.data.inboundId} of business ${job.data.businessId} failed: attempts exhausted`,
      );
    }
  }

  private async perBusiness(
    jobs: readonly DueInboundJob[],
    apply: (scope: Parameters<Parameters<InboundScopesPort['plain']>[1]>[0], job: DueInboundJob) => Promise<void>,
  ): Promise<void> {
    for (const job of jobs) {
      try {
        await this.ports.scopes.plain(toBusinessId(job.data.businessId), (scope) => apply(scope, job));
      } catch (error: unknown) {
        this.environment.logger.error(
          `Inbound webhook ${job.data.inboundId} of business ${job.data.businessId} could not be recorded: ${error instanceof Error ? error.name : typeof error}`,
        );
      }
    }
  }
}
