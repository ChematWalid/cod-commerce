import { MAX_LINE_OFFERS_APPLIED, MAX_ORDER_DISCOUNTS_APPLIED, MAX_QUOTE_CODES, MAX_QUOTE_LINES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { OfferUsageService } from '../../application/offer-usage.service';
import { orderUsageOf } from '../../domain/engine/order-usage';
import { InvalidQuoteRequestError } from '../../domain/errors';
import type { OrderUsage } from '../../domain/engine/order-usage';
import { FakeActiveStores } from '../fakes/fake-active-stores';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { aCode, anActiveOffer, newId, scopeA, scopeB } from '../support/offer-records';

const stores = new FakeActiveStores();
const ctx = stores.contextOf(scopeA);

/** A store with a code offer (total limit `limit`) and its code INFLU10 (limit `limit`), and the service over it. */
function setUpUsage(limit: number | null = 1) {
  const tables = new InMemoryOfferTables();
  const offer = anActiveOffer({ method: 'codes', totalUsageLimit: limit });
  tables.offerRows.push({ ...scopeA, value: offer });
  tables.codeRows.push({ ...scopeA, value: aCode(offer.id, 'INFLU10', { usageLimit: limit }) });
  const service = new OfferUsageService({ counter: tables.usage, stores });
  const counts = () => ({ offer: tables.offerRows[0]?.value.usageCount, code: tables.codeRows[0]?.value.usageCount });
  const uses = orderUsageOf([{ offerId: offer.id, code: 'INFLU10' }]);
  return { service, counts, uses };
}

describe('OfferUsageService (D2447)', () => {
  it("records an order's offer and code uses", async () => {
    // Arrange
    const { service, counts, uses } = setUpUsage(2);

    // Act
    const recorded = await service.recordOrderUses(ctx, scopeA, uses);

    // Assert
    expect(recorded).toEqual({ refusedOfferIds: [], refusedCodes: [] });
    expect(counts()).toEqual({ offer: 1, code: 1 });
  });

  it('reports the uses already at their limit and counts none of them', async () => {
    // Arrange
    const { service, counts, uses } = setUpUsage(1);
    await service.recordOrderUses(ctx, scopeA, uses);

    // Act
    const recorded = await service.recordOrderUses(ctx, scopeA, uses);

    // Assert
    expect(recorded).toEqual({ refusedOfferIds: uses.offerIds, refusedCodes: ['INFLU10'] });
    expect(counts()).toEqual({ offer: 1, code: 1 });
  });

  it("gives an order's uses back", async () => {
    // Arrange
    const { service, counts, uses } = setUpUsage(1);
    await service.recordOrderUses(ctx, scopeA, uses);

    // Act
    await service.releaseOrderUses(ctx, scopeA, uses);

    // Assert
    expect(counts()).toEqual({ offer: 0, code: 0 });
  });

  it("never counts a use in another business's store", async () => {
    // Arrange
    const { service, counts, uses } = setUpUsage(null);

    // Act
    const recorded = await service.recordOrderUses(stores.contextOf(scopeB), scopeB, uses);

    // Assert
    expect(recorded).toEqual({ refusedOfferIds: uses.offerIds, refusedCodes: ['INFLU10'] });
    expect(counts()).toEqual({ offer: 0, code: 0 });
  });

  it('refuses uses that break the order usage bounds as InvalidQuoteRequestError', async () => {
    // Arrange
    const { service } = setUpUsage();
    const bad = { offerIds: ['1 OR 1=1'], codes: [] } as OrderUsage;

    // Act
    const recording = service.recordOrderUses(ctx, scopeA, bad);
    const releasing = service.releaseOrderUses(ctx, scopeA, bad);

    // Assert
    await expect(recording).rejects.toBeInstanceOf(InvalidQuoteRequestError);
    await expect(releasing).rejects.toBeInstanceOf(InvalidQuoteRequestError);
  });

  it('accepts the uses of an order holding every line offer, order discount and the delivery waiver a quote applies', async () => {
    // Arrange: the most distinct offers one quote applies (D2411), one free_delivery offer among them (D2445).
    const { service } = setUpUsage();
    const mostApplied = MAX_QUOTE_LINES * MAX_LINE_OFFERS_APPLIED + MAX_ORDER_DISCOUNTS_APPLIED + 1;
    const applied = Array.from({ length: mostApplied }, (_unused, index) => ({
      offerId: newId(),
      ...(index < MAX_QUOTE_CODES ? { code: `CODE${String(index)}` } : {}),
    }));
    const uses = orderUsageOf(applied);

    // Act
    const recorded = await service.recordOrderUses(ctx, scopeA, uses);
    const releasing = service.releaseOrderUses(ctx, scopeA, uses);

    // Assert
    expect(recorded.refusedOfferIds).toHaveLength(mostApplied);
    expect(recorded.refusedCodes).toEqual(applied.flatMap((use) => use.code ?? []));
    await expect(releasing).resolves.toBeUndefined();
  });
});
