import { PLATFORM_CLOCK, PlatformJobsPlugin, type PlatformClock } from '@cod/plugin-platform-jobs';
import { PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { Inject } from '@nestjs/common';
import { Logger, PluginCommonModule, VendurePlugin } from '@vendure/core';
import { OutboxConsumerRegistry } from './application/consumer-registry';
import { DeliveryRunner } from './application/delivery-runner';
import { OutboxRelayService } from './application/outbox-relay.service';
import { OutboxService } from './application/outbox.service';
import type {
  OutboxAnnouncerPort,
  OutboxClock,
  OutboxEnvironment,
  OutboxIdSource,
  OutboxLogger,
  OutboxPorts,
  OutboxQueuesPort,
  OutboxScopesPort,
  OutboxStorePort,
} from './application/ports';
import {
  OUTBOX_ANNOUNCER,
  OUTBOX_CLOCK,
  OUTBOX_ENVIRONMENT,
  OUTBOX_IDS,
  OUTBOX_LOGGER,
  OUTBOX_PORTS,
  OUTBOX_QUEUES,
  OUTBOX_SCOPES,
  OUTBOX_STORE,
} from './application/tokens';
import { OUTBOX_LOG_CONTEXT } from './domain/constants';
import { AfterCommitRelaySubscriber } from './infrastructure/after-commit-relay.subscriber';
import { EventBusOutboxAnnouncer } from './infrastructure/event-bus-outbox-announcer';
import { OutboxDeliveryEntity } from './infrastructure/outbox-delivery.entity';
import { OutboxEventEntity } from './infrastructure/outbox-event.entity';
import { OutboxBootstrap } from './infrastructure/outbox-bootstrap';
import { PlatformOutboxQueues } from './infrastructure/platform-outbox-queues';
import { TypeOrmOutboxStore } from './infrastructure/typeorm-outbox.repositories';
import { VendureOutboxScopes } from './infrastructure/vendure-outbox-scopes';

const outboxLogger: OutboxLogger = {
  error: (message) => {
    Logger.error(message, OUTBOX_LOG_CONTEXT);
  },
  warn: (message) => {
    Logger.warn(message, OUTBOX_LOG_CONTEXT);
  },
};

/**
 * The transactional outbox (ADR 0016, D104-D107). Features write events with `OutboxService.add` inside their own
 * transaction and register `OutboxConsumer`s with `OutboxConsumerRegistry.register` in `onModuleInit`; this plugin
 * relays the committed events and runs each delivery exactly once for its database effects.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, PlatformJobsPlugin, PlatformPartitionsPlugin],
  entities: [OutboxEventEntity, OutboxDeliveryEntity],
  providers: [
    TypeOrmOutboxStore,
    { provide: OUTBOX_STORE, useExisting: TypeOrmOutboxStore },
    { provide: OUTBOX_SCOPES, useClass: VendureOutboxScopes },
    { provide: OUTBOX_ANNOUNCER, useClass: EventBusOutboxAnnouncer },
    PlatformOutboxQueues,
    { provide: OUTBOX_QUEUES, useExisting: PlatformOutboxQueues },
    { provide: OUTBOX_LOGGER, useValue: outboxLogger },
    { provide: OUTBOX_CLOCK, useExisting: PLATFORM_CLOCK },
    { provide: OUTBOX_IDS, useExisting: SNOWFLAKE_ID_GENERATOR },
    {
      provide: OUTBOX_PORTS,
      useFactory: (store: OutboxStorePort, scopes: OutboxScopesPort, queues: OutboxQueuesPort): OutboxPorts => ({
        store,
        scopes,
        queues,
      }),
      inject: [OUTBOX_STORE, OUTBOX_SCOPES, OUTBOX_QUEUES],
    },
    {
      provide: OUTBOX_ENVIRONMENT,
      useFactory: (clock: OutboxClock): OutboxEnvironment => ({ logger: outboxLogger, clock }),
      inject: [OUTBOX_CLOCK],
    },
    AfterCommitRelaySubscriber,
    OutboxBootstrap,
    {
      provide: OutboxConsumerRegistry,
      useFactory: (queues: OutboxQueuesPort) => new OutboxConsumerRegistry(queues),
      inject: [OUTBOX_QUEUES],
    },
    {
      provide: OutboxService,
      useFactory: (store: OutboxStorePort, announcer: OutboxAnnouncerPort, ids: OutboxIdSource, clock: PlatformClock) =>
        new OutboxService(store, announcer, ids, clock),
      inject: [OUTBOX_STORE, OUTBOX_ANNOUNCER, OUTBOX_IDS, OUTBOX_CLOCK],
    },
    {
      provide: OutboxRelayService,
      useFactory: (ports: OutboxPorts, registry: OutboxConsumerRegistry, environment: OutboxEnvironment) =>
        new OutboxRelayService(ports, registry, environment),
      inject: [OUTBOX_PORTS, OutboxConsumerRegistry, OUTBOX_ENVIRONMENT],
    },
    {
      // Built at module start, which binds it to the registry: every consumer queue then runs deliveries through it.
      provide: DeliveryRunner,
      useFactory: (ports: OutboxPorts, registry: OutboxConsumerRegistry, environment: OutboxEnvironment) =>
        new DeliveryRunner(ports, registry, environment),
      inject: [OUTBOX_PORTS, OutboxConsumerRegistry, OUTBOX_ENVIRONMENT],
    },
  ],
  exports: [OutboxService, OutboxConsumerRegistry],
  compatibility: '^3.8.0',
})
export class PlatformOutboxPlugin {
  constructor(@Inject(OutboxConsumerRegistry) private readonly registry: OutboxConsumerRegistry) {}

  /** Every `onModuleInit` has run: consumers can no longer register. */
  onApplicationBootstrap(): void {
    this.registry.close();
  }
}
