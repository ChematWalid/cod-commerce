import { type TenantRepository, TenantRepositoryFactory, tenantQuery } from '@cod/plugin-tenancy';
import type { TenantScope } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { NewOutboxDelivery, NewOutboxEvent, OutboxStorePort } from '../application/ports';
import { OutboxTransactionRequiredError } from '../domain/errors';
import type {
  OutboxDeliveryKey,
  OutboxDeliveryRecord,
  OutboxEventKey,
  OutboxEventRecord,
} from '../domain/outbox-event';
import { OutboxDeliveryEntity } from './outbox-delivery.entity';
import { OutboxEventEntity } from './outbox-event.entity';

const OPEN_STATUSES = ['pending', 'enqueued'];

const toEvent = (row: OutboxEventEntity): OutboxEventRecord => ({
  id: row.id,
  createdAt: row.createdAt,
  businessId: row.businessId,
  storeId: row.storeId,
  topic: row.topic,
  aggregateId: row.aggregateId,
  payload: row.payload,
  status: row.status,
});

const toDelivery = (row: OutboxDeliveryEntity): OutboxDeliveryRecord => ({
  createdAt: row.createdAt,
  outboxId: row.outboxId,
  consumer: row.consumer,
  status: row.status,
  attempts: row.attempts,
});

const deliveryWhere = (key: OutboxDeliveryKey) => ({
  createdAt: key.createdAt,
  outboxId: key.outboxId,
  consumer: key.consumer,
});

/** {@link OutboxStorePort} on `TenantRepository` (ADR 0002): every call carries the scope's business. */
@Injectable()
export class TypeOrmOutboxStore implements OutboxStorePort {
  private readonly events: TenantRepository<OutboxEventEntity>;
  private readonly deliveries: TenantRepository<OutboxDeliveryEntity>;

  constructor(repositories: TenantRepositoryFactory) {
    this.events = repositories.for(OutboxEventEntity);
    this.deliveries = repositories.for(OutboxDeliveryEntity);
  }

  async insertEvent(scope: TenantScope, row: NewOutboxEvent): Promise<void> {
    if (!this.events.inTransaction(scope)) {
      throw new OutboxTransactionRequiredError();
    }
    await this.events.insert(scope, {
      id: row.id,
      createdAt: row.createdAt,
      storeId: row.storeId,
      topic: row.topic,
      aggregateId: row.aggregateId,
      payload: row.payload,
      dedupeKey: row.dedupeKey,
      status: 'pending',
    });
  }

  async lockEvent(scope: TenantScope, key: OutboxEventKey): Promise<OutboxEventRecord | null> {
    const row = await tenantQuery(scope, this.events, 'e')
      .andWhere('e.id = :id', { id: key.id })
      .andWhere('e.createdAt = :createdAt', { createdAt: key.createdAt })
      .setLock('pessimistic_write')
      .getOne();
    return row === null ? null : toEvent(row);
  }

  async findEvent(scope: TenantScope, key: OutboxEventKey): Promise<OutboxEventRecord | null> {
    const row = await this.events.findOne(scope, { id: key.id, createdAt: key.createdAt });
    return row === null ? null : toEvent(row);
  }

  async markRelayed(scope: TenantScope, key: OutboxEventKey, at: Date): Promise<void> {
    await this.events.update(scope, { id: key.id, createdAt: key.createdAt }, { status: 'relayed', relayedAt: at });
  }

  async insertDeliveries(scope: TenantScope, rows: readonly NewOutboxDelivery[]): Promise<void> {
    for (const row of rows) {
      await this.deliveries.insert(scope, {
        createdAt: row.createdAt,
        outboxId: row.outboxId,
        consumer: row.consumer,
        status: 'pending',
        attempts: 0,
        updatedAt: row.at,
      });
    }
  }

  async pendingConsumers(scope: TenantScope, key: OutboxEventKey): Promise<string[]> {
    const rows = await this.deliveries.find(scope, {
      where: { createdAt: key.createdAt, outboxId: key.id, status: 'pending' },
      order: { consumer: 'ASC' },
    });
    return rows.map((row) => row.consumer);
  }

  async markEnqueued(scope: TenantScope, key: OutboxDeliveryKey, at: Date): Promise<void> {
    await this.deliveries.update(
      scope,
      { ...deliveryWhere(key), status: 'pending' },
      { status: 'enqueued', enqueuedAt: at, updatedAt: at },
    );
  }

  async findDelivery(scope: TenantScope, key: OutboxDeliveryKey): Promise<OutboxDeliveryRecord | null> {
    const row = await this.deliveries.findOne(scope, deliveryWhere(key));
    return row === null ? null : toDelivery(row);
  }

  async lockDelivery(scope: TenantScope, key: OutboxDeliveryKey): Promise<OutboxDeliveryRecord | null> {
    const row = await tenantQuery(scope, this.deliveries, 'd')
      .andWhere('d.createdAt = :createdAt', { createdAt: key.createdAt })
      .andWhere('d.outboxId = :outboxId', { outboxId: key.outboxId })
      .andWhere('d.consumer = :consumer', { consumer: key.consumer })
      .setLock('pessimistic_write')
      .getOne();
    return row === null ? null : toDelivery(row);
  }

  async recordAttempt(scope: TenantScope, key: OutboxDeliveryKey, at: Date): Promise<number | null> {
    const changed = await this.deliveries.update(
      scope,
      { ...deliveryWhere(key), status: In(OPEN_STATUSES) as never },
      { attempts: () => 'attempts + 1', updatedAt: at },
    );
    if (changed === 0) return null;
    return (await this.deliveries.findOne(scope, deliveryWhere(key)))?.attempts ?? null;
  }

  async finishDelivery(
    scope: TenantScope,
    key: OutboxDeliveryKey,
    outcome: Parameters<OutboxStorePort['finishDelivery']>[2],
    at: Date,
  ): Promise<void> {
    await this.deliveries.update(
      scope,
      { ...deliveryWhere(key), status: In(OPEN_STATUSES) as never },
      { status: outcome.status, lastError: outcome.lastError, updatedAt: at },
    );
  }
}
