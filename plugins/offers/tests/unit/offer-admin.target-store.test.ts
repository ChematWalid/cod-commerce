import type { OfferInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context.port';
import { QUANTITY_INPUT, setUpOfferAdmin } from '../support/offer-admin';
import { scopeA, scopeB } from '../support/offer-records';

const ctx = asOperationContext({});
const UNKNOWN_TARGETS = 'offers.unknown-targets';

/** A product discount on `targets`. */
const discountOn = (targets: OfferInput['targets']): OfferInput => ({
  kind: 'product_discount',
  title: 'Product discount',
  config: { valueType: 'percent', value: 10, appliesTo: 'targets' },
  targets,
});

/** The admin services with variant 11 and product 3 in store A, and variant 91 and product 9 in business B's store. */
function twoStores() {
  const admin = setUpOfferAdmin();
  admin.targets.stock(scopeA, { variantIds: ['11'], productIds: ['3'] });
  admin.targets.stock(scopeB, { variantIds: ['91'], productIds: ['9'] });
  return admin;
}

describe('OfferAdminService targets in the store (D2537)', () => {
  it("refuses a create naming another business's variant and writes no row", async () => {
    // Arrange
    const { service, tables } = twoStores();

    // Act
    const creating = service.createDraft(ctx, scopeA, discountOn([{ refType: 'variant', refId: '91' }]));

    // Assert
    await expect(creating).rejects.toMatchObject({ code: UNKNOWN_TARGETS });
    expect(tables.offerRows).toEqual([]);
  });

  it('refuses a create naming an unknown product', async () => {
    // Arrange
    const { service } = twoStores();

    // Act
    const creating = service.createDraft(ctx, scopeA, discountOn([{ refType: 'product', refId: '404' }]));

    // Assert
    await expect(creating).rejects.toMatchObject({ code: UNKNOWN_TARGETS });
  });

  it("accepts the store's own variant and product, and leaves collection targets unchecked until P2.S3", async () => {
    // Arrange
    const { service, targets } = twoStores();
    const input = discountOn([
      { refType: 'variant', refId: '11' },
      { refType: 'product', refId: '3' },
      { refType: 'collection', refId: '5' },
    ]);

    // Act
    const draft = await service.createDraft(ctx, scopeA, input);

    // Assert
    expect(draft.targets.map((target) => target.refId)).toEqual(['11', '3', '5']);
    expect(targets.calls).toEqual([{ variantIds: ['11'], productIds: ['3'] }]);
  });

  it("refuses an update adding another business's variant and keeps the offer", async () => {
    // Arrange
    const { service } = twoStores();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const editing = service.update(ctx, scopeA, draft.id, {
      targets: [
        { refType: 'variant', refId: '11' },
        { refType: 'variant', refId: '91' },
      ],
    });

    // Assert
    await expect(editing).rejects.toMatchObject({ code: UNKNOWN_TARGETS });
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ version: 1 });
  });

  it('keeps a draft editable when a stored target has left the store since: only added targets are checked', async () => {
    // Arrange
    const { service, targets } = twoStores();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    targets.empty(scopeA);

    // Act
    const edited = await service.update(ctx, scopeA, draft.id, { title: 'Renamed' });

    // Assert
    expect(edited).toMatchObject({ title: 'Renamed', version: 2 });
  });

  it('refuses to publish a draft whose target has left the store, and keeps it a draft', async () => {
    // Arrange
    const { service, targets } = twoStores();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    targets.empty(scopeA);

    // Act
    const publishing = service.publish(ctx, scopeA, draft.id);

    // Assert
    await expect(publishing).rejects.toMatchObject({ code: UNKNOWN_TARGETS });
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ status: 'draft', publishedAt: null });
  });

  it('refuses to resume a paused offer whose target has left the store', async () => {
    // Arrange
    const { service, lifecycle, targets } = twoStores();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);
    await service.publish(ctx, scopeA, draft.id);
    await lifecycle.pause(ctx, scopeA, draft.id);
    targets.empty(scopeA);

    // Act
    const resuming = lifecycle.resume(ctx, scopeA, draft.id);

    // Assert
    await expect(resuming).rejects.toMatchObject({ code: UNKNOWN_TARGETS });
    await expect(service.get(ctx, scopeA, draft.id)).resolves.toMatchObject({ status: 'paused' });
  });

  it('publishes a draft whose targets are all rows of the store', async () => {
    // Arrange
    const { service } = twoStores();
    const draft = await service.createDraft(ctx, scopeA, QUANTITY_INPUT);

    // Act
    const published = await service.publish(ctx, scopeA, draft.id);

    // Assert
    expect(published.status).toBe('active');
  });
});
