import { describe, expect, it } from 'vitest';
import { OfferUsageService } from '../../application/offer-usage.service';
import { orderUsageOf } from '../../domain/engine/order-usage';
import { NoActiveStoreError } from '../../domain/errors';
import { FakeActiveStores } from '../fakes/fake-active-stores';
import { InMemoryOfferTables } from '../fakes/in-memory-offer-repository';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { aCode, anActiveOffer, scopeA, scopeA2, scopeB } from '../support/offer-records';

/** The admin over a store A1 that holds one code offer, a context on A1's channel and the fake that hands them out. */
async function setUpGuardedAdmin() {
  const stores = new FakeActiveStores();
  const { service, tables } = setUpOfferAdmin({ stores });
  const ctxA = stores.contextOf(scopeA);
  const offer = await service.createDraft(ctxA, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
  return { service, tables, stores, ctxA, offer };
}

describe('OfferAdminService channel guard (D2448)', () => {
  it.each([
    ['store A2', scopeA2],
    ['business B', scopeB],
  ])("refuses every call on a ctx of %s's channel", async (_name, foreignScope) => {
    // Arrange
    const { service, tables, stores, offer } = await setUpGuardedAdmin();
    const ctx = stores.contextOf(foreignScope);
    const before = structuredClone(tables.offerRows);

    // Act
    const calls = [
      () => service.createDraft(ctx, scopeA, QUANTITY_INPUT),
      () => service.update(ctx, scopeA, offer.id, { title: 'Taken over' }),
      () => service.setStatus(ctx, scopeA, offer.id, 'active'),
      () => service.delete(ctx, scopeA, offer.id),
      () => service.get(ctx, scopeA, offer.id),
      () => service.list(ctx, scopeA),
      () => service.addCodes(ctx, scopeA, offer.id, [{ code: 'FOREIGN10' }]),
      () => service.removeCode(ctx, scopeA, offer.id, 'FOREIGN10'),
    ];
    const outcomes = [];
    for (const call of calls)
      outcomes.push(
        await call().then(
          () => 'served',
          (error: unknown) => error,
        ),
      );

    // Assert
    for (const outcome of outcomes) expect(outcome).toBeInstanceOf(NoActiveStoreError);
    expect(tables.offerRows).toEqual(before);
    expect(tables.codeRows).toEqual([]);
  });

  it("serves a ctx on the scope's own channel", async () => {
    // Arrange
    const { service, ctxA, offer } = await setUpGuardedAdmin();

    // Act
    const listed = await service.list(ctxA, scopeA);

    // Assert
    expect(listed.map((listed) => listed.id)).toEqual([offer.id]);
  });
});

describe('OfferUsageService channel guard (D2448)', () => {
  it("refuses to record or release uses on a ctx of another store's channel", async () => {
    // Arrange
    const tables = new InMemoryOfferTables();
    const stores = new FakeActiveStores();
    const offer = anActiveOffer({ method: 'codes' });
    tables.offerRows.push({ ...scopeA, value: { ...offer, usageCount: 1 } });
    tables.codeRows.push({ ...scopeA, value: aCode(offer.id, 'INFLU10', { usageCount: 1 }) });
    const service = new OfferUsageService({ counter: tables.usage, stores });
    const uses = orderUsageOf([{ offerId: offer.id, code: 'INFLU10' }]);
    const ctxA2 = stores.contextOf(scopeA2);

    // Act
    const recording = await service.recordOrderUses(ctxA2, scopeA, uses).catch((error: unknown) => error);
    const releasing = await service.releaseOrderUses(ctxA2, scopeA, uses).catch((error: unknown) => error);

    // Assert
    expect(recording).toBeInstanceOf(NoActiveStoreError);
    expect(releasing).toBeInstanceOf(NoActiveStoreError);
    expect(tables.offerRows[0]?.value.usageCount).toBe(1);
    expect(tables.codeRows[0]?.value.usageCount).toBe(1);
  });
});
