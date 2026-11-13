import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DURABLE_JOB_KINDS, durableJobId } from '@cod/shared';
import { EventBus, Logger } from '@vendure/core';
import { OUTBOX_QUEUES } from '../application/tokens';
import { OUTBOX_LOG_CONTEXT } from '../domain/constants';
import type { OutboxQueuesPort } from '../application/ports';
import { OutboxEventsWrittenEvent } from './outbox-events-written.event';

/**
 * Starts the relay of every event once its transaction has committed. A failure here leaves the rows `pending`, which
 * the sweeper picks up (Task 7); it is logged, never thrown into the caller's response.
 */
@Injectable()
export class AfterCommitRelaySubscriber implements OnApplicationBootstrap {
  constructor(
    private readonly eventBus: EventBus,
    @Inject(OUTBOX_QUEUES) private readonly queues: OutboxQueuesPort,
  ) {}

  onApplicationBootstrap(): void {
    this.eventBus.ofType(OutboxEventsWrittenEvent).subscribe((event) => {
      void this.enqueue(event);
    });
  }

  private async enqueue(event: OutboxEventsWrittenEvent): Promise<void> {
    const { businessId } = event;
    for (const written of event.events) {
      try {
        await this.queues.enqueueRelay({
          jobId: durableJobId(DURABLE_JOB_KINDS.outboxRelay, written.id),
          outboxId: written.id,
          createdAt: written.createdAt,
          businessId,
        });
      } catch (error: unknown) {
        Logger.error(`Could not queue the relay of outbox event ${written.id}: ${String(error)}`, OUTBOX_LOG_CONTEXT);
      }
    }
  }
}
