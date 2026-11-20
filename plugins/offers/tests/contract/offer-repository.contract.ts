import type { StoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { NoActiveStoreError } from '../../domain/errors';
import type { OfferCodeRepositoryPort, OfferRepositoryPort } from '../../domain/ports/offer-repository.port';
import type { OperationContext } from '../../domain/ports/operation-context.port';
import type { StoreScope } from '../../domain/store-scope';
import { at } from '../support/builders';
import { aCode, anActiveOffer, anOfferRecord, scopeA, scopeA2, scopeB } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

/** Both offer repositories over empty tables (codes hang off offers) and the context their calls run in. */
export interface OfferHarness {
  readonly offers: OfferRepositoryPort;
  readonly codes: OfferCodeRepositoryPort;
  readonly ctx: OperationContext;
}

/** Builds a fresh harness for one contract case. */
export type MakeOfferHarness = () => Promise<OfferHarness>;

/** A scope whose store is missing, as an untyped caller that skipped the store check would build it (D2405). */
const storeless = { businessId: scopeA.businessId, storeId: '' as StoreId } satisfies StoreScope;

/** The behaviour every {@link OfferRepositoryPort} adapter must have, store and business isolation included. */
export function describeOfferRepositoryContract(name: string, make: MakeOfferHarness): void {
  describe(`${name} (OfferRepositoryPort contract)`, () => {
    it('finds an offer only in its business', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const offer = anOfferRecord();

      // Act
      await offers.create(ctx, scopeA, offer);

      // Assert
      await expect(offers.findById(ctx, scopeA, offer.id)).resolves.toEqual(offer);
      await expect(offers.findById(ctx, scopeB, offer.id)).resolves.toBeUndefined();
      await expect(offers.list(ctx, scopeB, {})).resolves.toEqual([]);
    });

    it('finds an offer only in its store', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const offer = anActiveOffer();
      await offers.create(ctx, scopeA, offer);

      // Act
      const fromOtherStore = await offers.findById(ctx, scopeA2, offer.id);
      const activeInOtherStore = await offers.activeOf(ctx, scopeA2);

      // Assert
      expect(fromOtherStore).toBeUndefined();
      expect(activeInOtherStore).toEqual([]);
      await expect(offers.list(ctx, scopeA2, {})).resolves.toEqual([]);
    });

    it('lists active offers of the store with their targets', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const targets = [
        { role: 'buy', refType: 'product', refId: '7' },
        { role: 'buy', refType: 'variant', refId: '12' },
        { role: 'buy', refType: 'collection', refId: '3' },
      ] as const;
      const offer = anActiveOffer({ targets: targets.map((target) => ({ ...target })) });
      await offers.create(ctx, scopeA, offer);
      await offers.create(ctx, scopeB, anActiveOffer());

      // Act
      const active = await offers.activeOf(ctx, scopeA);

      // Assert
      expect(active).toEqual([offer]);
      expect(active[0]?.targets).toEqual(targets);
    });

    it('leaves draft, paused and archived offers out of activeOf', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const active = anActiveOffer();
      for (const offer of [
        anOfferRecord(),
        anActiveOffer({ status: 'paused', pausedAt: at(1) }),
        anActiveOffer({ status: 'archived', archivedAt: at(2) }),
        active,
      ]) {
        await offers.create(ctx, scopeA, offer);
      }

      // Act
      const listed = await offers.activeOf(ctx, scopeA);

      // Assert
      expect(listed.map((offer) => offer.id)).toEqual([active.id]);
      await expect(offers.list(ctx, scopeA, {})).resolves.toHaveLength(4);
      await expect(offers.list(ctx, scopeA, { status: 'paused' })).resolves.toHaveLength(1);
    });

    it('stores config, eligibility and label as given', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const offer = anOfferRecord({
        method: 'codes',
        label: { ar: 'عرض خاص', fr: 'Offre', en: 'Deal' },
        config: { priceMode: 'total', tiers: [{ quantity: 3, price: 12_900, preselected: true, freeDelivery: true }] },
        combinesWith: { order: true, product: false, delivery: true },
        eligibility: { audience: 'first', channels: ['storefront'], wilayas: ['16', '31'], deliveryMethods: ['desk'] },
        totalUsageLimit: 100,
        perBuyerLimit: 1,
        startsAt: at(10),
        endsAt: at(20),
      });

      // Act
      await offers.create(ctx, scopeA, offer);

      // Assert
      await expect(offers.findById(ctx, scopeA, offer.id)).resolves.toEqual(offer);
    });

    it('lists the offers of its store newest first', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const [older, newer] = [anOfferRecord({ createdAt: at(1) }), anOfferRecord({ createdAt: at(2) })];
      await offers.create(ctx, scopeA, older);
      await offers.create(ctx, scopeA, newer);

      // Act
      const listed = await offers.list(ctx, scopeA, {});

      // Assert
      expect(listed.map((offer) => offer.id)).toEqual([newer.id, older.id]);
    });

    it('updates an offer of its store only and replaces its targets', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const offer = anOfferRecord();
      await offers.create(ctx, scopeA, offer);
      const edited = {
        ...offer,
        title: 'Edited',
        version: 2,
        updatedAt: at(5),
        targets: [{ role: 'buy' as const, refType: 'product' as const, refId: '99' }],
      };

      // Act
      const fromOtherStore = await offers.update(ctx, scopeA2, edited, 1);
      const fromOtherBusiness = await offers.update(ctx, scopeB, edited, 1);
      const fromOwnStore = await offers.update(ctx, scopeA, edited, 1);

      // Assert
      expect([fromOtherStore, fromOtherBusiness, fromOwnStore]).toEqual([false, false, true]);
      await expect(offers.findById(ctx, scopeA, offer.id)).resolves.toEqual(edited);
    });

    it('refuses an update read at a version another write has since moved past', async () => {
      // Arrange
      const { offers, ctx } = await make();
      const offer = anOfferRecord();
      await offers.create(ctx, scopeA, offer);
      const archived = { ...offer, status: 'archived' as const, archivedAt: at(4), version: 2, updatedAt: at(4) };
      await offers.update(ctx, scopeA, archived, 1);
      const staleEdit = {
        ...offer,
        title: 'Stale',
        version: 2,
        updatedAt: at(5),
        targets: [{ role: 'buy' as const, refType: 'product' as const, refId: '99' }],
      };

      // Act
      const saved = await offers.update(ctx, scopeA, staleEdit, 1);

      // Assert
      expect(saved).toBe(false);
      await expect(offers.findById(ctx, scopeA, offer.id)).resolves.toEqual(archived);
    });

    it('deletes an offer with its targets and codes', async () => {
      // Arrange
      const { offers, codes, ctx } = await make();
      const offer = anOfferRecord();
      await offers.create(ctx, scopeA, offer);
      await codes.add(ctx, scopeA, [aCode(offer.id, 'GONE10')]);

      // Act
      const fromOtherStore = await offers.delete(ctx, scopeA2, offer.id);
      const fromOtherBusiness = await offers.delete(ctx, scopeB, offer.id);
      const fromOwnStore = await offers.delete(ctx, scopeA, offer.id);

      // Assert
      expect([fromOtherStore, fromOtherBusiness, fromOwnStore]).toEqual([false, false, true]);
      await expect(offers.findById(ctx, scopeA, offer.id)).resolves.toBeUndefined();
      await expect(codes.findByCodes(ctx, scopeA, ['GONE10'])).resolves.toEqual([]);
      await expect(offers.create(ctx, scopeA, { ...offer, title: 'Again' })).resolves.toBeUndefined();
      // A target left behind by the delete would read back as a duplicate here.
      await expect(offers.findById(ctx, scopeA, offer.id)).resolves.toEqual({ ...offer, title: 'Again' });
    });

    it('refuses a store-less offer or code', async () => {
      // Arrange
      const { offers, codes, ctx } = await make();
      const offer = anOfferRecord();
      await offers.create(ctx, scopeA, offer);

      // Act
      const offerWrite = await rejectionOf(offers.create(ctx, storeless, anOfferRecord()));
      const codeWrite = await rejectionOf(codes.add(ctx, storeless, [aCode(offer.id)]));

      // Assert
      expect(offerWrite).toBeInstanceOf(NoActiveStoreError);
      expect(codeWrite).toBeInstanceOf(NoActiveStoreError);
    });
  });
}
