import { requestContextOf, type TenantRepository, TenantRepositoryFactory, tenantQuery } from '@cod/plugin-tenancy';
import { type BusinessId, type TenantScope, toBusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import type {
  InboundStorePort,
  InboundWebhookKey,
  InboundWebhookRow,
  NewInboundKey,
  NewInboundWebhook,
} from '../application/ports';
import { InboundWebhookEntity } from './inbound-webhook.entity';
import { InboundWebhookKeyEntity } from './inbound-webhook-key.entity';

const toRow = (row: InboundWebhookEntity): InboundWebhookRow => ({
  id: row.id,
  receivedAt: row.receivedAt,
  businessId: toBusinessId(row.businessId) satisfies BusinessId,
  storeId: row.storeId,
  provider: row.provider,
  accountId: row.accountId,
  eventKey: row.eventKey,
  headers: row.headers,
  payload: row.payload,
  status: row.status,
  attempts: row.attempts,
});

const whereKey = (key: InboundWebhookKey) => ({ id: key.id, receivedAt: key.receivedAt });

/**
 * {@link InboundStorePort}: the stored webhooks go through `TenantRepository` (ADR 0002). The dedupe key is a platform
 * table, so its insert is raw SQL (`ON CONFLICT DO NOTHING`) in the caller's transaction; that is why this file is on
 * the raw-data-access list.
 */
@Injectable()
export class WebhookStore implements InboundStorePort {
  private readonly webhooks: TenantRepository<InboundWebhookEntity>;

  constructor(
    private readonly connection: TransactionalConnection,
    repositories: TenantRepositoryFactory,
  ) {
    this.webhooks = repositories.for(InboundWebhookEntity);
  }

  async insertKey(scope: TenantScope, key: NewInboundKey): Promise<boolean> {
    const keys = this.connection.getRepository(requestContextOf(scope), InboundWebhookKeyEntity);
    const inserted = await keys.manager.query<unknown[]>(
      `INSERT INTO "inbound_webhook_key" ("provider", "accountId", "eventKey", "receivedAt")
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING 1`,
      [key.provider, key.accountId, key.eventKey, key.receivedAt],
    );
    return inserted.length > 0;
  }

  async insertWebhook(scope: TenantScope, row: NewInboundWebhook): Promise<void> {
    await this.webhooks.insert(scope, {
      id: row.id,
      receivedAt: row.receivedAt,
      storeId: row.storeId,
      provider: row.provider,
      accountId: row.accountId,
      eventKey: row.eventKey,
      contentType: row.contentType,
      headers: { ...row.headers },
      payload: row.payload,
      status: 'received',
      attempts: 0,
      updatedAt: row.receivedAt,
    });
  }

  async find(scope: TenantScope, key: InboundWebhookKey): Promise<InboundWebhookRow | null> {
    const row = await this.webhooks.findOne(scope, whereKey(key));
    return row === null ? null : toRow(row);
  }

  async lock(scope: TenantScope, key: InboundWebhookKey): Promise<InboundWebhookRow | null> {
    const row = await tenantQuery(scope, this.webhooks, 'w')
      .andWhere('w.id = :id', { id: key.id })
      .andWhere('w.receivedAt = :receivedAt', { receivedAt: key.receivedAt })
      .setLock('pessimistic_write')
      .getOne();
    return row === null ? null : toRow(row);
  }

  async recordAttempt(scope: TenantScope, key: InboundWebhookKey, at: Date): Promise<number | null> {
    const changed = await this.webhooks.update(
      scope,
      { ...whereKey(key), status: 'received' },
      { attempts: () => 'attempts + 1', updatedAt: at },
    );
    if (changed === 0) return null;
    return (await this.webhooks.findOne(scope, whereKey(key)))?.attempts ?? null;
  }

  async finish(
    scope: TenantScope,
    key: InboundWebhookKey,
    outcome: Parameters<InboundStorePort['finish']>[2],
    at: Date,
  ): Promise<void> {
    await this.webhooks.update(
      scope,
      { ...whereKey(key), status: 'received' },
      { status: outcome.status, lastError: outcome.lastError, processedAt: at, updatedAt: at },
    );
  }

  async markReenqueued(scope: TenantScope, key: InboundWebhookKey, at: Date): Promise<void> {
    await this.webhooks.update(scope, { ...whereKey(key), status: 'received' }, { updatedAt: at });
  }
}
