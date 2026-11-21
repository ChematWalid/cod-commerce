import { describe, expect, it } from 'vitest';
import { newOfferPerformanceRegistry } from '../../application/default-sources';
import { OfferStatsService } from '../../application/offer-stats.service';
import { NoActiveStoreError } from '../../domain/errors';
import type { OfferPerformanceSource } from '../../domain/ports/offer-performance.port';
import type { StoreScope } from '../../domain/store-scope';
import { FakeActiveStores } from '../fakes/fake-active-stores';
import { scopeA, scopeB } from '../support/offer-records';

const stores = new FakeActiveStores();
const ctx = stores.contextOf(scopeA);

/** A source with one delivered order of 9,620 holding offer 7001 with 980 off, recording the scopes it is asked. */
function aRecordingSource() {
  const asked: StoreScope[] = [];
  const source: OfferPerformanceSource = {
    factsOf: (_ctx, scope) => {
      asked.push(scope);
      return Promise.resolve([
        { orderId: '9001', state: 'delivered', total: 9_620, offers: [{ offerId: '7001', amount: 980 }] },
      ]);
    },
  };
  return { source, asked };
}

describe('OfferStatsService (D2514)', () => {
  it('answers zeros for every offer until an order source is registered', async () => {
    // Arrange
    const service = new OfferStatsService({ stores, performance: newOfferPerformanceRegistry() });

    // Act
    const performance = await service.performanceOf(ctx, scopeA, ['7001', '7002']);

    // Assert
    expect([...performance]).toEqual([
      ['7001', { orders: 0, deliveredRevenue: 0, discountGiven: 0 }],
      ['7002', { orders: 0, deliveredRevenue: 0, discountGiven: 0 }],
    ]);
  });

  it("aggregates the registered source's orders of the scope's store", async () => {
    // Arrange
    const registry = newOfferPerformanceRegistry();
    const { source, asked } = aRecordingSource();
    registry.register(source);
    const service = new OfferStatsService({ stores, performance: registry });

    // Act
    const performance = await service.performanceOf(ctx, scopeA, ['7001']);

    // Assert
    expect(performance.get('7001')).toEqual({ orders: 1, deliveredRevenue: 9_620, discountGiven: 980 });
    expect(asked).toEqual([scopeA]);
  });

  it("refuses a ctx on another store's channel without asking the source", async () => {
    // Arrange
    const registry = newOfferPerformanceRegistry();
    const { source, asked } = aRecordingSource();
    registry.register(source);
    const service = new OfferStatsService({ stores, performance: registry });

    // Act
    const stats = service.performanceOf(ctx, scopeB, ['7001']);

    // Assert
    await expect(stats).rejects.toBeInstanceOf(NoActiveStoreError);
    expect(asked).toEqual([]);
  });
});
