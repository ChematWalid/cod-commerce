import { PartitionRegistry } from '@cod/plugin-platform-partitions';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { OutboxRelayService } from '../application/outbox-relay.service';
import { outboxPartitionPolicies } from './outbox-partition-policies';
import { PlatformOutboxQueues } from './platform-outbox-queues';

/**
 * Everything the outbox registers in `onModuleInit`, before the queue and partition registries close at bootstrap:
 * its relay queue and the retention policies of its tables.
 */
@Injectable()
export class OutboxBootstrap implements OnModuleInit {
  constructor(
    @Inject(PlatformOutboxQueues) private readonly queues: PlatformOutboxQueues,
    @Inject(OutboxRelayService) private readonly relay: OutboxRelayService,
    @Inject(PartitionRegistry) private readonly partitions: PartitionRegistry,
    @Inject(TransactionalConnection) private readonly connection: TransactionalConnection,
  ) {}

  onModuleInit(): void {
    this.queues.defineRelayQueue((data) => this.relay.relay(data));
    for (const policy of outboxPartitionPolicies(this.connection)) {
      this.partitions.register(policy);
    }
  }
}
