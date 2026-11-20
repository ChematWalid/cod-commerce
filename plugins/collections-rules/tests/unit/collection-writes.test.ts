import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import type { StoreCollectionDto } from '../../dashboard/dto';
import { type CollectionWrites, saveCollection } from '../../dashboard/model/collection-writes';
import { type CollectionForm, collectionFormOf, emptyCollectionForm } from '../../dashboard/model/editor-form';
import type { ManualProduct } from '../../dashboard/model/manual-order';

const product = (productId: string): ManualProduct => ({
  productId,
  title: `T ${productId}`,
  status: 'active',
  price: 1,
});

const CREATED: StoreCollectionDto = {
  id: '41',
  title: 'Summer',
  slug: 'summer',
  description: null,
  featuredAsset: null,
  mode: 'manual',
  rule: null,
  visible: true,
  position: 0,
  productCount: 0,
};

const REFUSAL = Object.assign(new Error('refused'), {
  extensions: { code: COLLECTIONS_ERROR_CODES.PRODUCT_NOT_FOUND },
});

function stubWrites(setProducts: CollectionWrites['setProducts']) {
  return {
    create: vi.fn<CollectionWrites['create']>().mockResolvedValue(CREATED),
    update: vi.fn<CollectionWrites['update']>().mockResolvedValue(CREATED),
    setProducts: vi.fn<CollectionWrites['setProducts']>(setProducts),
  };
}

describe('collection save writes', () => {
  it('a failed product set after a create never creates the collection twice', async () => {
    // Arrange
    const form: CollectionForm = { ...emptyCollectionForm(), title: 'Summer', products: [product('1'), product('2')] };
    const writes = stubWrites(() => Promise.reject(REFUSAL));

    // Act
    const first = await saveCollection(writes, { collectionId: null, saved: null }, form);
    writes.setProducts.mockResolvedValue({ ...CREATED, productCount: 2 });
    const retry = await saveCollection(
      writes,
      { collectionId: CREATED.id, saved: collectionFormOf(CREATED, []) },
      form,
    );

    // Assert
    expect(first).toEqual({ kind: 'created-without-products', collection: CREATED, error: REFUSAL });
    expect(retry).toEqual({ kind: 'saved', collection: { ...CREATED, productCount: 2 } });
    expect(writes.create).toHaveBeenCalledTimes(1);
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.setProducts).toHaveBeenNthCalledWith(2, CREATED.id, ['1', '2']);
  });

  it('a failed create is rethrown and sends nothing else', async () => {
    // Arrange
    const form: CollectionForm = { ...emptyCollectionForm(), title: 'Summer', products: [product('1')] };
    const writes = stubWrites(() => Promise.resolve(CREATED));
    writes.create.mockRejectedValue(REFUSAL);

    // Act
    const saving = saveCollection(writes, { collectionId: null, saved: null }, form);

    // Assert
    await expect(saving).rejects.toBe(REFUSAL);
    expect(writes.setProducts).not.toHaveBeenCalled();
  });

  it('answers null when nothing changed since the last save', async () => {
    // Arrange
    const saved = collectionFormOf(CREATED, [product('1')]);
    const writes = stubWrites(() => Promise.resolve(CREATED));

    // Act
    const answer = await saveCollection(writes, { collectionId: CREATED.id, saved }, saved);

    // Assert
    expect(answer).toBeNull();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.setProducts).not.toHaveBeenCalled();
  });
});
