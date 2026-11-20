import { describe, expect, it } from 'vitest';
import { OfferNotFoundError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { at } from '../support/builders';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA, scopeA2 } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

/** A code offer of store A with every copied field set, published, with one code. */
async function setUpCodeOffer() {
  const setUp = setUpOfferAdmin();
  const draft = await setUp.service.createDraft(ctx, scopeA, {
    ...QUANTITY_INPUT,
    method: 'codes',
    label: { ar: 'عرض', en: 'Deal' },
    combinesWith: { order: true },
    eligibility: { audience: 'first', channels: ['storefront'], wilayas: ['16'] },
    totalUsageLimit: 50,
    perBuyerLimit: 1,
    startsAt: at(1).toISOString(),
    endsAt: at(100).toISOString(),
    targets: [
      { refType: 'variant', refId: '11' },
      { refType: 'product', refId: '7' },
    ],
  });
  await setUp.service.addCodes(ctx, scopeA, draft.id, [{ code: 'COPYME10' }]);
  const offer = await setUp.lifecycle.publish(ctx, scopeA, draft.id);
  return { ...setUp, offer };
}

describe('OfferLifecycleService.duplicate (D2511)', () => {
  it('copies fields and targets into a new draft without codes', async () => {
    // Arrange
    const { lifecycle, codeBook, offer, setNow } = await setUpCodeOffer();
    setNow(at(20));

    // Act
    const copy = await lifecycle.duplicate(ctx, scopeA, offer.id);

    // Assert
    expect(copy).toEqual({
      ...offer,
      id: copy.id,
      status: 'draft',
      publishedAt: null,
      pausedAt: null,
      archivedAt: null,
      usageCount: 0,
      version: 1,
      createdAt: at(20),
      updatedAt: at(20),
    });
    expect(copy.id).not.toBe(offer.id);
    await expect(codeBook.list(ctx, scopeA, copy.id)).resolves.toEqual([]);
    await expect(codeBook.list(ctx, scopeA, offer.id)).resolves.toHaveLength(1);
  });

  it('duplicates an archived offer', async () => {
    // Arrange
    const { service, lifecycle, offer } = await setUpCodeOffer();
    await lifecycle.archive(ctx, scopeA, offer.id);

    // Act
    const copy = await lifecycle.duplicate(ctx, scopeA, offer.id);

    // Assert
    expect(copy).toMatchObject({ status: 'draft', archivedAt: null, title: offer.title });
    await expect(service.get(ctx, scopeA, copy.id)).resolves.toEqual(copy);
  });

  it("refuses another store's offer as not found", async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const copied = await rejectionOf(lifecycle.duplicate(ctx, scopeA2, draft.id));

    // Assert
    expect(copied).toBeInstanceOf(OfferNotFoundError);
    await expect(service.list(ctx, scopeA2)).resolves.toEqual({ items: [], totalItems: 0 });
  });
});
