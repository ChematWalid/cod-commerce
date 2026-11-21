import { OFFER_PAGE_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { at } from '../support/builders';
import { aCode, anActiveOffer, anOfferRecord, scopeA, scopeA2, scopeB } from '../support/offer-records';
import type { MakeOfferHarness } from './offer-repository.contract';

/** No product or variant filter: the whole store, one page of up to `take` offers after `skip`. */
const page = (skip: number, take: number) => ({ skip, take });

/**
 * The paged list, the code counts and the unpaged active offers every adapter must give (D2513), confined to the
 * scope's store.
 */
export function describeOfferListContract(name: string, make: MakeOfferHarness): void {
  describe(`${name} (offer list contract)`, () => {
    it('pages a list inside one store', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const own = [at(1), at(2), at(3)].map((createdAt) => anOfferRecord({ createdAt }));
      for (const offer of own) await offers.create(ctx, scopeA, offer);
      await offers.create(ctx, scopeA2, anOfferRecord({ createdAt: at(4) }));
      await offers.create(ctx, scopeB, anOfferRecord({ createdAt: at(5) }));

      // Act
      const second = await offers.list(ctx, scopeA, page(1, 1));
      const first = await offers.list(ctx, scopeA, page(0, 2));

      // Assert
      expect(second.totalItems).toBe(3);
      expect(second.items).toEqual([own[1]]);
      expect(first.items.map((offer) => offer.id)).toEqual([own[2]?.id, own[1]?.id]);
    });

    it('filters by status, kind and product or variant refs of any role', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const onProduct = anActiveOffer({ targets: [{ role: 'buy', refType: 'product', refId: '7' }] });
      const onVariant = anOfferRecord({ targets: [{ role: 'get', refType: 'variant', refId: '12' }] });
      const other = anOfferRecord({ kind: 'order_discount', targets: [] });
      for (const offer of [onProduct, onVariant, other]) await offers.create(ctx, scopeA, offer);
      await offers.create(ctx, scopeA2, anOfferRecord({ targets: [{ role: 'buy', refType: 'variant', refId: '12' }] }));
      const refs = { productIds: ['7'], variantIds: ['12'] };

      // Act
      const byRefs = await offers.list(ctx, scopeA, { ...page(0, 10), refs });
      const byKind = await offers.list(ctx, scopeA, { ...page(0, 10), kind: 'order_discount' });
      const byStatus = await offers.list(ctx, scopeA, { ...page(0, 10), status: 'active', refs });
      const noRefs = await offers.list(ctx, scopeA, { ...page(0, 10), refs: { productIds: [], variantIds: [] } });

      // Assert
      expect(byRefs.items.map((offer) => offer.id).sort()).toEqual([onProduct.id, onVariant.id].sort());
      expect(byRefs.totalItems).toBe(2);
      expect(byKind.items).toEqual([other]);
      expect(byStatus.items).toEqual([onProduct]);
      expect(noRefs).toEqual({ items: [], totalItems: 0 });
    });

    it('activeOf returns every active offer beyond one page', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const count = OFFER_PAGE_MAX + 1;
      for (let index = 0; index < count; index += 1) await offers.create(ctx, scopeA, anActiveOffer());
      await offers.create(ctx, scopeA, anOfferRecord());

      // Act
      const active = await offers.activeOf(ctx, scopeA);

      // Assert
      expect(active).toHaveLength(count);
    });

    it('activeOf returns active offers newest first so a quote keeps one order', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const [oldest, middle, newest] = [
        anActiveOffer({ createdAt: at(1) }),
        anActiveOffer({ createdAt: at(2) }),
        anActiveOffer({ createdAt: at(3) }),
      ];
      for (const offer of [middle, oldest, newest]) await offers.create(ctx, scopeA, offer);

      // Act
      const active = await offers.activeOf(ctx, scopeA);

      // Assert
      expect(active.map((offer) => offer.id)).toEqual([newest.id, middle.id, oldest.id]);
    });

    it("counts codes only in the scope's store", async () => {
      // Arrange
      const { offers, codes, ctx } = await make();
      const [a, other, a2] = [anOfferRecord(), anOfferRecord(), anOfferRecord()];
      await offers.create(ctx, scopeA, a);
      await offers.create(ctx, scopeA, other);
      await offers.create(ctx, scopeA2, a2);
      await codes.add(ctx, scopeA, [aCode(a.id, 'ONE10'), aCode(a.id, 'TWO10')]);
      await codes.add(ctx, scopeA2, [aCode(a2.id, 'ONE10')]);

      // Act
      const counts = await codes.countByOffer(ctx, scopeA, [a.id, other.id, a2.id]);
      const none = await codes.countByOffer(ctx, scopeA, []);

      // Assert
      expect(Object.fromEntries(counts)).toEqual({ [a.id]: 2 });
      expect(none.size).toBe(0);
    });

    it('deletes an offer only while it has the status asked for', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const [active, draft] = [anActiveOffer(), anOfferRecord()];
      await offers.create(ctx, scopeA, active);
      await offers.create(ctx, scopeA, draft);

      // Act
      const activeDeleted = await offers.delete(ctx, scopeA, active.id, 'draft');
      const draftInOtherStore = await offers.delete(ctx, scopeA2, draft.id, 'draft');
      const draftDeleted = await offers.delete(ctx, scopeA, draft.id, 'draft');

      // Assert
      expect([activeDeleted, draftInOtherStore, draftDeleted]).toEqual([false, false, true]);
      await expect(offers.findById(ctx, scopeA, active.id)).resolves.toEqual(active);
      await expect(offers.findById(ctx, scopeA, draft.id)).resolves.toBeUndefined();
    });
  });
}
