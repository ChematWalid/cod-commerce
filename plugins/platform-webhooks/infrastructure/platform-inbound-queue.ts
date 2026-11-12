import { PlatformQueues } from '@cod/plugin-platform-jobs';
import { Injectable } from '@nestjs/common';
import type { InboundQueuePort } from '../application/ports';
import { INBOUND_WEBHOOKS_QUEUE } from '../domain/constants';
import type { InboundJobData } from '../domain/inbound-webhook-handler';

/** {@link InboundQueuePort} on the platform's durable queues (D99, D102). */
@Injectable()
export class PlatformInboundQueue implements InboundQueuePort {
  constructor(private readonly queues: PlatformQueues) {}

  enqueue(data: InboundJobData): Promise<void> {
    return this.queues.add(INBOUND_WEBHOOKS_QUEUE, data);
  }

  /** Creates the queue with its processor. Only during `onModuleInit`. */
  define(process: (data: InboundJobData, job: { attempts: number; retries: number }) => Promise<void>): void {
    this.queues.define<InboundJobData>(INBOUND_WEBHOOKS_QUEUE, process);
  }
}
