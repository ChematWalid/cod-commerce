import { RequestTenantScope, TenancyPlugin, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { Inject } from '@nestjs/common';
import { PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { OutboxConsumerRegistry } from '../../application/consumer-registry';
import { OutboxParkError } from '../../domain/errors';
import type { OutboxConsumer, OutboxDelivery } from '../../domain/outbox-event';
import { OutboxEventEntity } from '../../infrastructure/outbox-event.entity';
import { PlatformOutboxPlugin } from '../../platform-outbox.plugin';

/** One row per handler run that committed: the fixture's own table, written in the handler's transaction. */
@Entity({ name: 'outbox_counting_seen' })
export class CountingSeenEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ type: 'bigint' })
  seenBusinessId!: string;
}

/** What each delivery's handler saw through its scope: the outbox event ids the scope's business can read. */
export const seenThroughScope = new Map<string, string[]>();

/** A message far over the 500 characters `lastError` keeps, with no part of any payload in it. */
export const LONG_FAILURE_MESSAGE = `boom ${'x'.repeat(2000)}`;

/**
 * Four consumers. `counting` (`platform.demo`, queue `order-effects`) records its run and fails while the payload's
 * `failUntilAttempt` is not reached; `bystander` listens to another topic; `always-failing` (`product.changed`, queue
 * `analytics`) never succeeds; `parking` parks its delivery.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin],
  entities: [CountingSeenEntity],
})
export class CountingConsumerPlugin {
  constructor(
    @Inject(OutboxConsumerRegistry) private readonly registry: OutboxConsumerRegistry,
    @Inject(TransactionalConnection) private readonly connection: TransactionalConnection,
    @Inject(TenantRepositoryFactory) private readonly repositories: TenantRepositoryFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.recording('counting', 'platform.demo'));
    this.registry.register(this.recording('bystander', 'order.placed'));
    this.registry.register({
      name: 'always-failing',
      topics: ['product.changed'],
      queue: 'analytics',
      handle: () => Promise.reject(new Error(LONG_FAILURE_MESSAGE)),
    });
    this.registry.register({
      name: 'parking',
      topics: ['parcel.status_changed'],
      queue: 'order-effects',
      handle: () => Promise.reject(new OutboxParkError('the parcel is unknown to the carrier')),
    });
  }

  private recording(name: string, topic: OutboxConsumer['topics'][number]): OutboxConsumer {
    return {
      name,
      topics: [topic],
      queue: 'order-effects',
      handle: async (delivery: OutboxDelivery, scope): Promise<void> => {
        const failUntil = delivery.payload['failUntilAttempt'];
        if (typeof failUntil === 'number' && delivery.attempt <= failUntil) throw new Error('flaky consumer');
        const ctx = scope instanceof RequestTenantScope ? scope.ctx : undefined;
        const visible = await this.repositories.for(OutboxEventEntity).find(scope);
        seenThroughScope.set(
          delivery.idempotencyKey,
          visible.map((row) => row.id),
        );
        await this.connection
          .getRepository(ctx, CountingSeenEntity)
          .insert({ idempotencyKey: delivery.idempotencyKey, seenBusinessId: delivery.businessId });
      },
    };
  }
}
