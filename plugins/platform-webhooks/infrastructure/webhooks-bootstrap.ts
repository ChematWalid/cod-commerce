import { PartitionRegistry } from '@cod/plugin-platform-partitions';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { InboundProcessor } from '../application/inbound-processor';
import { inboundWebhookPartitionPolicy } from './inbound-partition-policy';
import { PlatformInboundQueue } from './platform-inbound-queue';

/** What the gateway registers in `onModuleInit`, before the queue and partition registries close: its queue and the retention policy of its table. */
@Injectable()
export class WebhooksBootstrap implements OnModuleInit {
  constructor(
    @Inject(PlatformInboundQueue) private readonly queue: PlatformInboundQueue,
    @Inject(InboundProcessor) private readonly processor: InboundProcessor,
    @Inject(PartitionRegistry) private readonly partitions: PartitionRegistry,
  ) {}

  onModuleInit(): void {
    this.queue.define((data, job) => this.processor.run(data, job));
    this.partitions.register(inboundWebhookPartitionPolicy);
  }
}
