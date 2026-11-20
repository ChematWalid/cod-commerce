import { describe, expect, it } from 'vitest';
import { CodeTakenError, OfferNotFoundError } from '../../domain/errors';
import { at } from '../support/builders';
import { aCode, anOfferRecord, scopeA, scopeA2, scopeB } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';
import type { MakeOfferHarness, OfferHarness } from './offer-repository.contract';

/** A harness with one offer created in `scopeA`, `scopeA2` and `scopeB` each. */
async function withOffers(make: MakeOfferHarness) {
  const harness: OfferHarness = await make();
  const [a, a2, b] = [anOfferRecord(), anOfferRecord(), anOfferRecord()];
  await harness.offers.create(harness.ctx, scopeA, a);
  await harness.offers.create(harness.ctx, scopeA2, a2);
  await harness.offers.create(harness.ctx, scopeB, b);
  return { ...harness, a, a2, b };
}

/** The behaviour every `OfferCodeRepositoryPort` adapter must have, store and business isolation included. */
export function describeOfferCodeRepositoryContract(name: string, make: MakeOfferHarness): void {
  describe(`${name} (OfferCodeRepositoryPort contract)`, () => {
    it('refuses a second code of the same text in one store', async () => {
      // Arrange
      const { codes, ctx, a } = await withOffers(make);
      await codes.add(ctx, scopeA, [aCode(a.id, 'INFLU10')]);

      // Act
      const sameOffer = await rejectionOf(codes.add(ctx, scopeA, [aCode(a.id, 'INFLU10')]));
      const inOneCall = await rejectionOf(codes.add(ctx, scopeA, [aCode(a.id, 'TWICE'), aCode(a.id, 'TWICE')]));

      // Assert
      expect(sameOffer).toBeInstanceOf(CodeTakenError);
      expect(inOneCall).toBeInstanceOf(CodeTakenError);
      await expect(codes.listOf(ctx, scopeA, a.id)).resolves.toHaveLength(1);
    });

    it('refuses a code another offer of the store already has', async () => {
      // Arrange
      const harness = await make();
      const [first, second] = [anOfferRecord(), anOfferRecord()];
      await harness.offers.create(harness.ctx, scopeA, first);
      await harness.offers.create(harness.ctx, scopeA, second);
      await harness.codes.add(harness.ctx, scopeA, [aCode(first.id, 'SHARED')]);

      // Act
      const onSecond = harness.codes.add(harness.ctx, scopeA, [aCode(second.id, 'SHARED')]);

      // Assert
      await expect(onSecond).rejects.toBeInstanceOf(CodeTakenError);
      await expect(harness.codes.listOf(harness.ctx, scopeA, second.id)).resolves.toEqual([]);
    });

    it('allows the same code in another store and another business', async () => {
      // Arrange
      const { codes, ctx, a, a2, b } = await withOffers(make);
      await codes.add(ctx, scopeA, [aCode(a.id, 'INFLU10')]);

      // Act
      await codes.add(ctx, scopeA2, [aCode(a2.id, 'INFLU10')]);
      await codes.add(ctx, scopeB, [aCode(b.id, 'INFLU10')]);

      // Assert
      await expect(codes.findByCodes(ctx, scopeA2, ['INFLU10'])).resolves.toHaveLength(1);
      await expect(codes.findByCodes(ctx, scopeB, ['INFLU10'])).resolves.toHaveLength(1);
    });

    it('finds codes by their normalised text, in the store only', async () => {
      // Arrange
      const { codes, ctx, a, b } = await withOffers(make);
      const code = aCode(a.id, 'INFLU10', { usageLimit: 50, createdAt: at(3) });
      await codes.add(ctx, scopeA, [code]);
      await codes.add(ctx, scopeB, [aCode(b.id, 'OTHER5')]);

      // Act
      const found = await codes.findByCodes(ctx, scopeA, [' influ10 ', 'NOPE', 'OTHER5']);

      // Assert
      expect(found).toEqual([code]);
      await expect(codes.findByCodes(ctx, scopeA, [])).resolves.toEqual([]);
    });

    it('refuses a target or code for an offer of another store', async () => {
      // Arrange
      const { codes, offers, ctx, a, b } = await withOffers(make);

      // Act
      const intoOtherStore = await rejectionOf(codes.add(ctx, scopeA2, [aCode(a.id, 'CROSS1')]));
      const intoOtherBusiness = await rejectionOf(codes.add(ctx, scopeA, [aCode(b.id, 'CROSS2')]));
      const retarget = await offers.update(ctx, scopeA2, { ...a, targets: [], version: a.version + 1 }, a.version);

      // Assert
      expect(intoOtherStore).toBeInstanceOf(OfferNotFoundError);
      expect(intoOtherBusiness).toBeInstanceOf(OfferNotFoundError);
      expect(retarget).toBe(false);
      await expect(offers.findById(ctx, scopeA, a.id)).resolves.toEqual(a);
      await expect(codes.findByCodes(ctx, scopeA2, ['CROSS1'])).resolves.toEqual([]);
    });

    it('lists and removes the codes of its offer only', async () => {
      // Arrange
      const { codes, ctx, a } = await withOffers(make);
      const [first, second] = [
        aCode(a.id, 'FIRST1', { createdAt: at(1) }),
        aCode(a.id, 'SECOND', { createdAt: at(2) }),
      ];
      await codes.add(ctx, scopeA, [first, second]);

      // Act
      const fromOtherStore = await codes.remove(ctx, scopeA2, a.id, 'FIRST1');
      const fromOwnStore = await codes.remove(ctx, scopeA, a.id, ' first1 ');

      // Assert
      expect([fromOtherStore, fromOwnStore]).toEqual([false, true]);
      await expect(codes.listOf(ctx, scopeA, a.id)).resolves.toEqual([second]);
      await expect(codes.listOf(ctx, scopeA2, a.id)).resolves.toEqual([]);
    });
  });
}
