import type { OfferInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidQuoteRequestError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { at } from '../support/builders';
import { ORDER_DISCOUNT_INPUT, QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA, scopeA2 } from '../support/offer-records';
import { rejectionOf } from '../support/rejection';

const ctx = asOperationContext({});

/** {@link QUANTITY_INPUT} on one target of `refType` `refId`. */
const quantityOn = (refType: 'product' | 'variant', refId: string): OfferInput => ({
  ...QUANTITY_INPUT,
  targets: [{ refType, refId }],
});

describe('OfferAdminService.list (D2513)', () => {
  it('pages newest first with totalItems', async () => {
    // Arrange
    const { service, setNow } = setUpOfferAdmin();
    const created = [];
    for (const minute of [1, 2, 3]) {
      setNow(at(minute));
      created.push(await service.createDraft(ctx, scopeA, QUANTITY_INPUT));
    }

    // Act
    const page = await service.list(ctx, scopeA, { skip: 1, take: 1 });
    const all = await service.list(ctx, scopeA);

    // Assert
    expect(page.totalItems).toBe(3);
    expect(page.items.map((offer) => offer.id)).toEqual([created[1]?.id]);
    expect(all.items.map((offer) => offer.id)).toEqual(created.map((offer) => offer.id).reverse());
  });

  it('filters by kind and status', async () => {
    // Arrange
    const { service, lifecycle } = setUpOfferAdmin();
    const quantity = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    const order = await service.createDraft(ctx, scopeA, ORDER_DISCOUNT_INPUT);
    await lifecycle.publish(ctx, scopeA, order.id);

    // Act
    const byKind = await service.list(ctx, scopeA, { kind: 'quantity' });
    const byStatus = await service.list(ctx, scopeA, { status: 'active' });

    // Assert
    expect(byKind).toMatchObject({ totalItems: 1, items: [{ id: quantity.id }] });
    expect(byStatus).toMatchObject({ totalItems: 1, items: [{ id: order.id }] });
  });

  it('filters by a product through its variants', async () => {
    // Arrange
    const { service, variants } = setUpOfferAdmin();
    variants.set(scopeA, '7', ['12', '13']);
    const onProduct = await service.createDraft(ctx, scopeA, quantityOn('product', '7'));
    const onVariant = await service.createDraft(ctx, scopeA, quantityOn('variant', '13'));
    await service.createDraft(ctx, scopeA, quantityOn('variant', '99'));
    await service.createDraft(ctx, scopeA, quantityOn('product', '8'));

    // Act
    const listed = await service.list(ctx, scopeA, { productId: '7' });

    // Assert
    expect(listed.totalItems).toBe(2);
    expect(listed.items.map((offer) => offer.id).sort()).toEqual([onProduct.id, onVariant.id].sort());
  });

  it('counts codes per offer', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();
    const coded = await service.createDraft(ctx, scopeA, { ...QUANTITY_INPUT, method: 'codes' });
    const plain = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    await service.addCodes(ctx, scopeA, coded.id, [{ code: 'ONE10' }, { code: 'TWO10' }]);

    // Act
    const listed = await service.list(ctx, scopeA);

    // Assert
    const counts = Object.fromEntries(listed.items.map((offer) => [offer.id, offer.codeCount]));
    expect(counts).toEqual({ [coded.id]: 2, [plain.id]: 0 });
  });

  it("never lists another store's offer for a product id of that store", async () => {
    // Arrange
    const { service, variants } = setUpOfferAdmin();
    variants.set(scopeA2, '7', ['12']);
    await service.createDraft(ctx, scopeA2, quantityOn('variant', '12'));
    await service.createDraft(ctx, scopeA2, quantityOn('product', '7'));

    // Act
    const listed = await service.list(ctx, scopeA, { productId: '7' });

    // Assert
    expect(listed).toEqual({ items: [], totalItems: 0 });
  });

  it('refuses a page larger than the maximum', async () => {
    // Arrange
    const { service } = setUpOfferAdmin();

    // Act
    const refusal = await rejectionOf(service.list(ctx, scopeA, { take: 51 }));

    // Assert
    expect(refusal).toBeInstanceOf(InvalidQuoteRequestError);
  });
});
