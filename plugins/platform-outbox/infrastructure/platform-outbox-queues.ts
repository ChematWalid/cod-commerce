import { PlatformQueues } from '@cod/plugin-platform-jobs';
import type { QueueName } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import type { JobAttemptInfo, OutboxQueuesPort } from '../application/ports';
import type { OutboxDeliveryJobData, OutboxRelayJobData } from '../domain/outbox-event';
import { OUTBOX_RELAY_QUEUE } from '../domain/constants';

/** {@link OutboxQueuesPort} on the platform's durable queues (D99, D102). */
@Injectable()
export class PlatformOutboxQueues implements OutboxQueuesPort {
  constructor(private readonly queues: PlatformQueues) {}

  enqueueRelay(data: OutboxRelayJobData): Promise<void> {
    return this.queues.add(OUTBOX_RELAY_QUEUE, data);
  }

  enqueueDelivery(queue: QueueName, data: OutboxDeliveryJobData): Promise<void> {
    return this.queues.add(queue, data);
  }

  defineDeliveryQueue(
    queue: QueueName,
    process: (data: OutboxDeliveryJobData, job: JobAttemptInfo) => Promise<void>,
  ): void {
    this.queues.define<OutboxDeliveryJobData>(queue, process);
  }

  defineRelayQueue(process: (data: OutboxRelayJobData) => Promise<void>): void {
    this.queues.define<OutboxRelayJobData>(OUTBOX_RELAY_QUEUE, (data) => process(data));
  }
}
