import { describe, expect, it } from 'vitest';
import { aCode, anOfferRecord, scopeA, scopeA2, scopeB } from '../support/offer-records';
import type { MakeOfferHarness } from './offer-repository.contract';

/** A harness with offer `a` (total limit `limit`) and its code `INFLU10` (limit `limit`) in `scopeA`. */
async function withLimitedOffer(make: MakeOfferHarness, limit: number | null = 1) {
  const harness = await make();
  const a = anOfferRecord({ method: 'codes', totalUsageLimit: limit });
  await harness.offers.create(harness.ctx, scopeA, a);
  await harness.codes.add(harness.ctx, scopeA, [aCode(a.id, 'INFLU10', { usageLimit: limit })]);
  const counts = async () => ({
    offer: (await harness.offers.findById(harness.ctx, scopeA, a.id))?.usageCount,
    code: (await harness.codes.listOf(harness.ctx, scopeA, a.id))[0]?.usageCount,
  });
  return { ...harness, a, counts };
}

/** The behaviour every `OfferUsageCounterPort` adapter must have (D2447), store and business isolation included. */
export function describeOfferUsageCounterContract(name: string, make: MakeOfferHarness): void {
  describe(`${name} (OfferUsageCounterPort contract)`, () => {
    it('counts a use of an offer and of a code (typed in any case) while they have uses left', async () => {
      // Arrange
      const { usage, ctx, a, counts } = await withLimitedOffer(make, 2);

      // Act
      const offerCounted = await usage.recordOfferUse(ctx, scopeA, a.id);
      const codeCounted = await usage.recordCodeUse(ctx, scopeA, ' influ10 ');

      // Assert
      expect([offerCounted, codeCounted]).toEqual([true, true]);
      await expect(counts()).resolves.toEqual({ offer: 1, code: 1 });
    });

    it('refuses a use past the limit and leaves the count at the limit', async () => {
      // Arrange
      const { usage, ctx, a, counts } = await withLimitedOffer(make, 1);
      await usage.recordOfferUse(ctx, scopeA, a.id);
      await usage.recordCodeUse(ctx, scopeA, 'INFLU10');

      // Act
      const offerCounted = await usage.recordOfferUse(ctx, scopeA, a.id);
      const codeCounted = await usage.recordCodeUse(ctx, scopeA, 'INFLU10');

      // Assert
      expect([offerCounted, codeCounted]).toEqual([false, false]);
      await expect(counts()).resolves.toEqual({ offer: 1, code: 1 });
    });

    it('counts every use of an offer and a code without a limit', async () => {
      // Arrange
      const { usage, ctx, a, counts } = await withLimitedOffer(make, null);

      // Act
      for (let use = 0; use < 3; use += 1) {
        await usage.recordOfferUse(ctx, scopeA, a.id);
        await usage.recordCodeUse(ctx, scopeA, 'INFLU10');
      }

      // Assert
      await expect(counts()).resolves.toEqual({ offer: 3, code: 3 });
    });

    it('gives a use back, never below zero', async () => {
      // Arrange
      const { usage, ctx, a, counts } = await withLimitedOffer(make, 1);
      await usage.recordOfferUse(ctx, scopeA, a.id);
      await usage.recordCodeUse(ctx, scopeA, 'INFLU10');

      // Act
      const released = [
        await usage.releaseOfferUse(ctx, scopeA, a.id),
        await usage.releaseCodeUse(ctx, scopeA, 'INFLU10'),
      ];
      const belowZero = [
        await usage.releaseOfferUse(ctx, scopeA, a.id),
        await usage.releaseCodeUse(ctx, scopeA, 'INFLU10'),
      ];

      // Assert
      expect(released).toEqual([true, true]);
      expect(belowZero).toEqual([false, false]);
      await expect(counts()).resolves.toEqual({ offer: 0, code: 0 });
    });

    it("never counts a use of another store's or another business's offer or code", async () => {
      // Arrange
      const { usage, ctx, a, counts } = await withLimitedOffer(make, null);

      // Act
      const results = [
        await usage.recordOfferUse(ctx, scopeA2, a.id),
        await usage.recordOfferUse(ctx, scopeB, a.id),
        await usage.recordCodeUse(ctx, scopeA2, 'INFLU10'),
        await usage.recordCodeUse(ctx, scopeB, 'INFLU10'),
      ];

      // Assert
      expect(results).toEqual([false, false, false, false]);
      await expect(counts()).resolves.toEqual({ offer: 0, code: 0 });
    });

    it("never gives back a use from another store's or another business's scope", async () => {
      // Arrange
      const { usage, ctx, a, counts } = await withLimitedOffer(make, null);
      await usage.recordOfferUse(ctx, scopeA, a.id);
      await usage.recordCodeUse(ctx, scopeA, 'INFLU10');

      // Act
      const results = [
        await usage.releaseOfferUse(ctx, scopeA2, a.id),
        await usage.releaseOfferUse(ctx, scopeB, a.id),
        await usage.releaseCodeUse(ctx, scopeA2, 'INFLU10'),
        await usage.releaseCodeUse(ctx, scopeB, 'INFLU10'),
      ];

      // Assert
      expect(results).toEqual([false, false, false, false]);
      await expect(counts()).resolves.toEqual({ offer: 1, code: 1 });
    });
  });
}
