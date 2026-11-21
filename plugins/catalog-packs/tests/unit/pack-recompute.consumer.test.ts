import { type OutboxDelivery, OutboxParkError } from '@cod/plugin-platform-outbox';
import { RequestTenantScope } from '@cod/plugin-tenancy';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { RecomputePacksService } from '../../application/recompute-packs.service';
import type { StoreScope } from '../../domain/store-scope';
import { PackRecomputeConsumer } from '../../infrastructure/pack-recompute.consumer';
import { aPackRecord, aProduct } from '../support/builders';
import type { InlineTransaction } from '../fakes/inline-transaction';
import { packWorld, SCOPE_A, SCOPE_B } from '../fakes/pack-world';

const STORE_CTX = { channelId: 7 } as unknown as RequestContext;
/** The context of the delivery's own transaction, which the runner hands the consumer. */
const DELIVERY_CTX = { channelId: 1, inDeliveryTransaction: true } as unknown as RequestContext;
const DELIVERY_SCOPE = new RequestTenantScope(DELIVERY_CTX, SCOPE_A.businessId);

/** A `product.changed` delivery of business A for product `productId` of `storeId`. */
function delivery(productId: string, storeId: string): OutboxDelivery {
  return {
    outboxId: '1',
    createdAt: new Date(0).toISOString(),
    businessId: SCOPE_A.businessId,
    storeId,
    topic: 'product.changed',
    aggregateId: productId,
    payload: { productId, storeId, change: 'updated' },
    consumer: 'catalog-packs-recompute',
    idempotencyKey: '1:catalog-packs-recompute',
    attempt: 1,
  };
}

function arranged() {
  const world = packWorld();
  const contexts: StoreScope[] = [];
  const joined: (RequestContext | undefined)[] = [];
  const storeContexts = {
    storeContext: (scope: StoreScope, within?: RequestContext): Promise<RequestContext> => {
      contexts.push(scope);
      joined.push(within);
      return Promise.resolve(STORE_CTX);
    },
  };
  const consumer = new PackRecomputeConsumer(storeContexts, new RecomputePacksService(world.ports));
  return { ...world, contexts, joined, consumer };
}

/** Components 11 and 12 and pack 20 of them, in business A's first store. */
function withPack(world: ReturnType<typeof arranged>): void {
  world.catalog.put(SCOPE_A, aProduct({ id: '11', price: 2500 }), aProduct({ id: '12', price: 2000 }));
  world.catalog.put(SCOPE_A, aProduct({ id: '20', type: 'pack', price: 3150 }));
  world.packs.put(SCOPE_A, aPackRecord('20'));
}

describe('PackRecomputeConsumer (D2203)', () => {
  it("builds the ctx with storeContext from payload.storeId and the delivery's business", async () => {
    // Arrange
    const world = arranged();
    withPack(world);
    const { consumer, contexts } = world;

    // Act
    await consumer.handle(delivery('11', SCOPE_A.storeId), DELIVERY_SCOPE);

    // Assert
    expect(contexts).toEqual([{ businessId: SCOPE_A.businessId, storeId: SCOPE_A.storeId }]);
    expect(consumer).toMatchObject({
      name: 'catalog-packs-recompute',
      topics: ['product.changed'],
      queue: 'integrations',
    });
  });

  it("reads only packs of the event's business", async () => {
    // Arrange
    const { catalog, packs, consumer } = arranged();
    for (const scope of [SCOPE_A, SCOPE_B]) {
      catalog.put(scope, aProduct({ id: '11', price: 2500 }), aProduct({ id: '12', price: 2000 }));
      catalog.put(scope, aProduct({ id: '20', type: 'pack', price: 3150 }));
      packs.put(scope, aPackRecord('20'));
    }

    // Act
    await consumer.handle(delivery('11', SCOPE_A.storeId), DELIVERY_SCOPE);

    // Assert
    expect(new Set(packs.reads)).toEqual(new Set([SCOPE_A.businessId]));
    expect(catalog.get(SCOPE_A, '20')?.price).toBe(4050);
    expect(catalog.get(SCOPE_B, '20')?.price).toBe(3150);
  });

  it('parks a payload that names no product or store', async () => {
    // Arrange
    const { consumer, contexts } = arranged();
    const broken = { ...delivery('11', SCOPE_A.storeId), payload: { productId: 11 } };

    // Act
    const handling = consumer.handle(broken, DELIVERY_SCOPE);

    // Assert
    await expect(handling).rejects.toThrow(OutboxParkError);
    expect(contexts).toEqual([]);
  });

  it.each(['abc', '0', '99999999999'])('parks a payload whose productId %s is not a product id', async (productId) => {
    // Arrange
    const { consumer, contexts, packs } = arranged();

    // Act
    const handling = consumer.handle(delivery(productId, SCOPE_A.storeId), DELIVERY_SCOPE);

    // Assert
    await expect(handling).rejects.toThrow(OutboxParkError);
    expect(contexts).toEqual([]);
    expect(packs.reads).toEqual([]);
  });

  it('skips a product that is no pack and no component: no store context and no transaction (#260, D2282)', async () => {
    // Arrange
    const world = arranged();
    withPack(world);
    world.catalog.put(SCOPE_A, aProduct({ id: '30', price: 900 }));

    // Act
    await world.consumer.handle(delivery('30', SCOPE_A.storeId), DELIVERY_SCOPE);

    // Assert
    expect(world.contexts).toEqual([]);
    expect(world.lock.acquired).toEqual([]);
    expect((world.ports.transaction as InlineTransaction).runs).toBe(0);
    expect(world.catalog.writes).toEqual([]);
  });

  it("looks the packs up in the delivery's own transaction, never on a second connection (#260, D2282)", async () => {
    // Arrange
    const world = arranged();
    world.catalog.put(SCOPE_A, aProduct({ id: '30', price: 900 }));

    // Act
    await world.consumer.handle(delivery('30', SCOPE_A.storeId), DELIVERY_SCOPE);

    // Assert
    expect(world.packs.readContexts).not.toHaveLength(0);
    expect(world.packs.readContexts.every((ctx) => ctx === (DELIVERY_CTX as unknown))).toBe(true);
  });

  it("builds the store context inside the delivery's transaction for a component (#260, D2282)", async () => {
    // Arrange
    const world = arranged();
    withPack(world);

    // Act
    await world.consumer.handle(delivery('11', SCOPE_A.storeId), DELIVERY_SCOPE);

    // Assert
    expect(world.joined).toEqual([DELIVERY_CTX]);
    expect(world.lock.acquired).toEqual(['20']);
    expect(world.catalog.get(SCOPE_A, '20')?.price).toBe(4050);
  });
});
