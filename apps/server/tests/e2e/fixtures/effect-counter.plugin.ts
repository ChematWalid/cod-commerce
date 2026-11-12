import { createHmac, timingSafeEqual } from 'node:crypto';
import { OutboxConsumerRegistry, type OutboxConsumer, type OutboxDelivery } from '@cod/plugin-platform-outbox';
import { InboundWebhookHandlerRegistry, type InboundWebhookHandler } from '@cod/plugin-platform-webhooks';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PlatformWebhooksPlugin, type WebhookAccount } from '@cod/plugin-platform-webhooks';
import { RequestTenantScope, TenancyPlugin } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Inject } from '@nestjs/common';
import { PluginCommonModule, TransactionalConnection, VendurePlugin } from '@vendure/core';
import { Column, Entity, PrimaryColumn } from 'typeorm';

/** The provider, header names and signing secret of the fixture's inbound side (synthetic). */
export const EFFECT_PROVIDER = 'effects';
export const EFFECT_SIGNATURE_HEADER = 'x-effects-signature';
export const EFFECT_EVENT_HEADER = 'x-effects-event-id';
const EFFECT_SIGNING_SECRET = 'synthetic-effect-signing-secret';

/** Topics and consumer names of the two outbox consumers: one on a bulk queue, one on a critical queue. */
export const BULK_EFFECT_TOPIC = 'order.placed';
export const CRITICAL_EFFECT_TOPIC = 'order.confirmed';
export const BULK_EFFECT_CONSUMER = 'effect-capi';
export const CRITICAL_EFFECT_CONSUMER = 'effect-order-effects';

/**
 * One row per handler run that committed. The key is unique, so a second effect for the same delivery or webhook
 * fails the handler and leaves its row non-terminal. The e2e database is built by migrations only: the test creates
 * this table itself.
 */
@Entity({ name: 'e2e_effect_seen' })
export class EffectSeenEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  effectKey!: string;

  @Column({ type: 'bigint' })
  seenBusinessId!: string;
}

/** The DDL of {@link EffectSeenEntity}. */
export const EFFECT_TABLE_DDL = `CREATE TABLE IF NOT EXISTS "e2e_effect_seen" (
  "effectKey" varchar(100) PRIMARY KEY,
  "seenBusinessId" bigint NOT NULL
)`;

/** Accounts of the fixture provider by account key; the test fills it once it knows the business. */
export const effectAccounts = new Map<string, WebhookAccount>();

/** The signature the provider would send for `rawBody`. */
export function effectSignature(rawBody: Buffer | string): string {
  return `sha256=${createHmac('sha256', EFFECT_SIGNING_SECRET).update(rawBody).digest('hex')}`;
}

/**
 * An outbox consumer on `capi` (bulk) and one on `order-effects` (critical), and an inbound provider: each writes its
 * idempotency key to the effect table inside the handler's transaction. A payload's `failUntilAttempt` makes the
 * consumer throw while the delivery's attempt number is at or below it.
 */
@VendurePlugin({
  imports: [PluginCommonModule, TenancyPlugin, PlatformOutboxPlugin, PlatformWebhooksPlugin],
  entities: [EffectSeenEntity],
})
export class EffectCounterPlugin {
  constructor(
    @Inject(OutboxConsumerRegistry) private readonly outbox: OutboxConsumerRegistry,
    @Inject(InboundWebhookHandlerRegistry) private readonly inbound: InboundWebhookHandlerRegistry,
    @Inject(TransactionalConnection) private readonly connection: TransactionalConnection,
  ) {}

  onModuleInit(): void {
    this.outbox.register(this.consumer(BULK_EFFECT_CONSUMER, BULK_EFFECT_TOPIC, 'capi'));
    this.outbox.register(this.consumer(CRITICAL_EFFECT_CONSUMER, CRITICAL_EFFECT_TOPIC, 'order-effects'));
    this.inbound.register(this.provider());
  }

  private async record(scope: TenantScope, effectKey: string, businessId: string): Promise<void> {
    const ctx = scope instanceof RequestTenantScope ? scope.ctx : undefined;
    await this.connection.getRepository(ctx, EffectSeenEntity).insert({ effectKey, seenBusinessId: businessId });
  }

  private consumer(name: string, topic: OutboxConsumer['topics'][number], queue: OutboxConsumer['queue']): OutboxConsumer {
    return {
      name,
      topics: [topic],
      queue,
      handle: async (delivery: OutboxDelivery, scope: TenantScope): Promise<void> => {
        const failUntil = delivery.payload['failUntilAttempt'];
        if (typeof failUntil === 'number' && delivery.attempt <= failUntil) throw new Error('flaky consumer');
        await this.record(scope, delivery.idempotencyKey, delivery.businessId);
      },
    };
  }

  private provider(): InboundWebhookHandler {
    return {
      provider: EFFECT_PROVIDER,
      persistedHeaders: [EFFECT_EVENT_HEADER],
      resolveAccount: (accountKey) => Promise.resolve(effectAccounts.get(accountKey) ?? null),
      verify: (_account, request) => {
        const given = Buffer.from(request.headers[EFFECT_SIGNATURE_HEADER] ?? '');
        const wanted = Buffer.from(effectSignature(request.rawBody));
        return Promise.resolve(given.length === wanted.length && timingSafeEqual(given, wanted));
      },
      eventKey: (_account, request) => request.headers[EFFECT_EVENT_HEADER] ?? null,
      process: async (record, scope): Promise<'processed'> => {
        await this.record(scope, `iw:${record.id}`, record.businessId);
        return 'processed';
      },
    };
  }
}
