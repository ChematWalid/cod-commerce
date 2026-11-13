import { JOB_PRESENCE, type JobPresencePort, PlatformQueues } from '@cod/plugin-platform-jobs';
import { toBusinessId } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { KekRotationService } from '../application/kek-rotation.service';
import { SECRET_LOGGER } from '../application/tokens';
import type { SecretLogger } from '../application/tenant-secret.service';
import type { KekRewrapJobData } from '../domain/kek-rewrap-job';
import type { KekRing } from '../domain/ports/envelope-cipher.port';
import type { KekRewrapQueuePort } from '../domain/ports/kek-rotation.ports';

/** The queue of rewrap jobs: the platform's maintenance queue. */
export const KEK_REWRAP_QUEUE_NAME = 'platform-maintenance';

/**
 * {@link KekRewrapQueuePort} on the platform's durable queues. A job that exhausted its retries stays in BullMQ as
 * failed for 14 days and BullMQ ignores an add of its id meanwhile, so a rerun of the rotation that finds the
 * business still on a retired KEK removes the settled job first, the way the job reconciler does, and then adds it.
 */
@Injectable()
export class PlatformKekRewrapQueue implements KekRewrapQueuePort {
  constructor(
    private readonly queues: PlatformQueues,
    @Inject(JOB_PRESENCE) private readonly presence: JobPresencePort,
    @Inject(SECRET_LOGGER) private readonly logger: SecretLogger,
  ) {}

  async enqueue(job: KekRewrapJobData): Promise<void> {
    await this.clearSettled(job.jobId);
    await this.queues.add(KEK_REWRAP_QUEUE_NAME, job);
  }

  /** Removes a failed job of this id. A presence that cannot be read is logged and the add goes ahead. */
  private async clearSettled(jobId: string): Promise<void> {
    try {
      if ((await this.presence.stateOf(KEK_REWRAP_QUEUE_NAME, jobId)) !== 'failed') return;
      await this.presence.remove(KEK_REWRAP_QUEUE_NAME, jobId);
      this.logger.warn(`Removed the failed data key rewrap job ${jobId} so that the rotation can queue it again`);
    } catch (error) {
      // No pooled strategy (plugin tests) or Valkey trouble: the add below goes ahead, but a failed job that stayed
      // behind makes BullMQ ignore it, so say so.
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Could not clear a failed data key rewrap job ${jobId} before queueing it again: ${reason}`);
    }
  }
}

/**
 * Creates the maintenance queue with the processor that re-wraps one business's data key under the ring's active KEK.
 * A failure (a retired KEK left the ring) throws, so the queue retries and then keeps the job as failed.
 * Call it in `onModuleInit`.
 */
export function defineKekRewrapJob(queues: PlatformQueues, rotation: KekRotationService, ring: KekRing): void {
  queues.define<KekRewrapJobData>(KEK_REWRAP_QUEUE_NAME, async (data) => {
    await rotation.rewrap(toBusinessId(data.businessId), ring);
  });
}
