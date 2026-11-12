import { DURABLE_JOB_KINDS, durableJobId } from '@cod/shared';
import {
  OUTBOX_RELAY_QUEUE,
  OUTBOX_SWEEP_AFTER_MS,
  OUTBOX_SWEEP_BATCH_SIZE,
  OUTBOX_SWEEP_BUDGET_MS,
  OUTBOX_SWEEP_WINDOW_MS,
} from '../domain/constants';
import type {
  OutboxDueScanPort,
  OutboxEnvironment,
  OutboxQueuesPort,
  PendingEventRow,
  RelayJobPresencePort,
} from './ports';

/**
 * Starts the relay of events the after-commit subscriber never reached (a crash or a Valkey loss between commit and
 * enqueue, D104): `pending` rows older than a minute and younger than the retention window. The relay is idempotent
 * and the job id is the event's, so a row that was queued after all is harmless.
 */
export class OutboxSweeper {
  constructor(
    private readonly scan: OutboxDueScanPort,
    private readonly queues: Pick<OutboxQueuesPort, 'enqueueRelay'>,
    private readonly presence: RelayJobPresencePort,
    private readonly environment: OutboxEnvironment,
  ) {}

  /** One catch-up run as of `now`. Batches of 500 until none is left or the 40 s budget is spent. */
  async sweep(now: Date): Promise<{ enqueued: number }> {
    const range = {
      from: new Date(now.getTime() - OUTBOX_SWEEP_WINDOW_MS),
      to: new Date(now.getTime() - OUTBOX_SWEEP_AFTER_MS),
    };
    const deadline = this.environment.clock.now() + OUTBOX_SWEEP_BUDGET_MS;
    let enqueued = 0;
    let after: PendingEventRow | null = null;
    while (this.environment.clock.now() < deadline) {
      const batch = await this.scan.sweepBatch(range, after, OUTBOX_SWEEP_BATCH_SIZE, async (rows) => {
        enqueued += await this.enqueueAll(rows);
      });
      after = batch.at(-1) ?? after;
      if (batch.length < OUTBOX_SWEEP_BATCH_SIZE) break;
    }
    return { enqueued };
  }

  private async enqueueAll(rows: readonly PendingEventRow[]): Promise<number> {
    let done = 0;
    for (const row of rows) {
      try {
        const jobId = durableJobId(DURABLE_JOB_KINDS.outboxRelay, row.id);
        await this.clearSettled(jobId, row.id);
        await this.queues.enqueueRelay({
          jobId,
          outboxId: row.id,
          createdAt: row.createdAt.toISOString(),
          businessId: row.businessId,
        });
        done += 1;
      } catch (error: unknown) {
        // The row stays pending, so the next run tries again.
        this.environment.logger.error(
          `Sweeper could not queue the relay of outbox event ${row.id}: ${error instanceof Error ? error.name : typeof error}`,
        );
      }
    }
    return done;
  }

  /**
   * BullMQ ignores an add whose id it still holds, and keeps failed and completed jobs for days (D105). A pending
   * row whose relay job settled would be re-queued as a silent no-op every minute, so the job is removed first.
   */
  private async clearSettled(jobId: string, outboxId: string): Promise<void> {
    try {
      const state = await this.presence.stateOf(OUTBOX_RELAY_QUEUE, jobId);
      if (state === 'failed' || state === 'completed') await this.presence.remove(OUTBOX_RELAY_QUEUE, jobId);
    } catch (error: unknown) {
      // The add goes ahead; a job that stayed behind makes it a no-op, so say so (the message is left out).
      this.environment.logger.warn(
        `Sweeper could not clear a settled relay job of outbox event ${outboxId}: ${error instanceof Error ? error.name : typeof error}`,
      );
    }
  }
}
