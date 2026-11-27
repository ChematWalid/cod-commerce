import type { OutboxConsumerRegistry, OutboxDelivery } from '@cod/plugin-platform-outbox';
import { RequestTenantScope } from '@cod/plugin-tenancy';
import type { RequestContext } from '@vendure/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProjectionService } from '../../application/projection.service';
import type { ProjectionRebuildQueuePort } from '../../domain/ports/projection-rebuild-queue.port';
import type { StoreScope } from '../../domain/store-scope';
import { StorefrontProjectionConsumer } from '../../infrastructure/projection.consumer';
import { FakeProjectionSource, FakeStorefrontStores, STORE_A, STORE_B } from '../fakes/fake-storefront';
import { InMemoryProjectionRepository } from '../fakes/in-memory-projection.repository';

const OUTBOX_ID = '1500000000000000009';

class RecordingRebuilds implements ProjectionRebuildQueuePort {
  readonly asked: { scope: StoreScope; key: string }[] = [];

  enqueue(scope: StoreScope, key: string): Promise<void> {
    this.asked.push({ scope, key });
    return Promise.resolve();
  }
}

let projection: InMemoryProjectionRepository;
let rebuilds: RecordingRebuilds;
let consumer: StorefrontProjectionConsumer;

beforeEach(() => {
  const stores = new FakeStorefrontStores().add(STORE_A, 'hide');
  projection = new InMemoryProjectionRepository();
  rebuilds = new RecordingRebuilds();
  const service = new ProjectionService({ stores, source: new FakeProjectionSource(stores), projection });
  const registry = { register: () => undefined } as unknown as OutboxConsumerRegistry;
  consumer = new StorefrontProjectionConsumer(registry, service, rebuilds);
});

function storeChanged(scope: StoreScope, change: string): OutboxDelivery {
  return {
    outboxId: OUTBOX_ID,
    createdAt: '2026-11-20T00:00:00.000Z',
    businessId: scope.businessId,
    storeId: scope.storeId,
    topic: 'store.changed',
    aggregateId: scope.storeId,
    payload: { storeId: scope.storeId, businessId: scope.businessId, change },
    consumer: 'storefront-projection',
    idempotencyKey: `${OUTBOX_ID}:storefront-projection`,
    attempt: 1,
  };
}

const tenantOf = (scope: StoreScope): RequestTenantScope =>
  new RequestTenantScope({} as RequestContext, scope.businessId);

describe('StorefrontProjectionConsumer on store.changed', () => {
  it('re-applies the sold-out behaviour and schedules a rebuild on a settings change (names follow the language)', async () => {
    // Act
    await consumer.handle(storeChanged(STORE_A, 'settings'), tenantOf(STORE_A));

    // Assert
    expect(projection.relists).toEqual([{ scope: STORE_A, soldOutBehavior: 'hide' }]);
    expect(rebuilds.asked).toEqual([{ scope: STORE_A, key: OUTBOX_ID }]);
  });

  it.each(['status', 'domain'])('leaves the rows alone on a %s change', async (change) => {
    // Act
    await consumer.handle(storeChanged(STORE_A, change), tenantOf(STORE_A));

    // Assert
    expect(projection.relists).toEqual([]);
    expect(rebuilds.asked).toEqual([]);
  });

  it('schedules no rebuild for a store that is unavailable', async () => {
    // Act
    await consumer.handle(storeChanged(STORE_B, 'settings'), tenantOf(STORE_B));

    // Assert
    expect(rebuilds.asked).toEqual([]);
  });
});
