import { PlatformQueues } from '@cod/plugin-platform-jobs';
import { toBusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { KekRotationService } from '../application/kek-rotation.service';
import type { KekRewrapJobData } from '../domain/kek-rewrap-job';
import type { KekRing } from '../domain/ports/envelope-cipher.port';
import type { KekRewrapQueuePort } from '../domain/ports/kek-rotation.ports';

/** The queue of rewrap jobs: the platform's maintenance queue. */
export const KEK_REWRAP_QUEUE_NAME = 'platform-maintenance';

/** {@link KekRewrapQueuePort} on the platform's durable queues. */
@Injectable()
export class PlatformKekRewrapQueue implements KekRewrapQueuePort {
  constructor(private readonly queues: PlatformQueues) {}

  enqueue(job: KekRewrapJobData): Promise<void> {
    return this.queues.add(KEK_REWRAP_QUEUE_NAME, job);
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
