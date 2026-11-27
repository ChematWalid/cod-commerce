import type { QueuePool } from '@cod/shared';
import { ageSeconds } from '../domain/age';
import { INTAKE_SPOOL_LENGTH_UNTIL_P3S4, METRIC_NAMES, type MetricName, QUEUE_JOB_STATES } from '../domain/constants';
import { queueGaugesOf, type QueueSnapshot } from '../domain/queue-gauges';
import type { PlatformGaugeSources } from './ports';

/** One gauge value with its labels. */
export interface GaugeReading {
  readonly metric: MetricName;
  readonly value: number;
  readonly attributes: Readonly<Record<string, string>>;
}

const reading = (metric: MetricName, value: number, attributes: Record<string, string> = {}): GaugeReading => ({
  metric,
  value,
  attributes,
});

/**
 * Reads the platform gauges of ADR 0015 that no request path emits: the outbox backlog, the scheduler heartbeats
 * (the D120 numbers, until now only a staff query) and the queue depth per pool and job name. A source that fails
 * is logged and left out of this collection; the others are still reported.
 */
export class PlatformGaugesService {
  constructor(private readonly sources: PlatformGaugeSources) {}

  /** Every gauge value, read now. */
  async read(): Promise<GaugeReading[]> {
    const parts = await Promise.all([
      this.guarded('outbox backlog', () => this.outboxReadings()),
      this.guarded('scheduler heartbeats', () => this.taskReadings()),
      ...this.sources.pools.map((pool) => this.guarded(`queue pool ${pool}`, () => this.poolReadings(pool))),
    ]);
    return [...parts.flat(), reading(METRIC_NAMES.intakeSpoolLength, INTAKE_SPOOL_LENGTH_UNTIL_P3S4)];
  }

  private async guarded(source: string, read: () => Promise<GaugeReading[]>): Promise<GaugeReading[]> {
    try {
      return await read();
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.sources.logger.error(`Could not read the ${source} gauges; they are skipped this time: ${reason}`);
      return [];
    }
  }

  private async outboxReadings(): Promise<GaugeReading[]> {
    const summary = await this.sources.outbox.pendingSummary();
    const pending = reading(METRIC_NAMES.outboxPending, summary.pending);
    if (summary.oldest === null) return [pending, reading(METRIC_NAMES.outboxOldestAge, 0)];
    const age = ageSeconds(this.sources.now(), summary.oldest.getTime());
    return [pending, reading(METRIC_NAMES.outboxOldestAge, age)];
  }

  /** A task that never succeeded is left without a value: an alert on a missing series catches it. */
  private async taskReadings(): Promise<GaugeReading[]> {
    const lastSuccess = await this.sources.tasks.lastSuccess();
    const ids = new Set([...this.sources.tasks.scheduledTaskIds(), ...lastSuccess.keys()]);
    const now = this.sources.now();
    return [...ids].sort().flatMap((task) => {
      const at = lastSuccess.get(task);
      return at === undefined
        ? []
        : [reading(METRIC_NAMES.schedulerLastSuccessAge, ageSeconds(now, at.getTime()), { task })];
    });
  }

  private async poolReadings(pool: QueuePool): Promise<GaugeReading[]> {
    const snapshot = await this.sources.queues.snapshotOf(pool);
    return [...poolTotals(pool, snapshot), ...perQueue(pool, snapshot, this.sources.now())];
  }
}

function poolTotals(pool: QueuePool, snapshot: QueueSnapshot): GaugeReading[] {
  return QUEUE_JOB_STATES.map((state) => reading(METRIC_NAMES.queuePoolJobs, snapshot.counts[state], { pool, state }));
}

function perQueue(pool: QueuePool, snapshot: QueueSnapshot, nowMs: number): GaugeReading[] {
  const gauges = queueGaugesOf(snapshot.jobs, nowMs);
  return [
    ...gauges.counts.map(({ queue, state, count }) => reading(METRIC_NAMES.queueJobs, count, { pool, queue, state })),
    ...gauges.oldestWaiting.map(({ queue, ageSeconds: age }) =>
      reading(METRIC_NAMES.queueOldestWaitingAge, age, { pool, queue }),
    ),
  ];
}
