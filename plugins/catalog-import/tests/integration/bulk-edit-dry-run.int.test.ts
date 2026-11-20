import { RbacPlugin, ACTIVITY_LOG_SCHEMA } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { bulkEditClient } from './bulk-edit-kit';
import { importSuite } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const { bulkEdit, productsOfA, statusOf, activityCount } = bulkEditClient(suite);

describe('bulk edit dry run, nulls and concurrency (D2213, D2255)', () => {
  it('dryRun changes nothing and returns the same summary', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');
    const changes = { status: 'draft', price: { mode: 'percent', value: 10 } };

    // Act
    const dry = await bulkEdit({ productIds: [product.id], changes, dryRun: true });
    const untouched = await suite.kit.product(product.id);
    const real = await bulkEdit({ productIds: [product.id], changes });

    // Assert
    expect(untouched).toMatchObject({ status: 'active', price: 1000 });
    expect(dry).toEqual(real);
  });

  it("dryRun reports catalog's refusal of a pack price as the real run does, and writes nothing (D2255)", async () => {
    // Arrange
    const [pack] = await productsOfA(1, { type: 'pack', price: 0 });
    if (pack === undefined) throw new Error('no product');
    const changes = { status: 'draft', price: { mode: 'fixed', value: 700 } };

    // Act
    const dry = await bulkEdit({ productIds: [pack.id], changes, dryRun: true });
    const real = await bulkEdit({ productIds: [pack.id], changes });

    // Assert
    expect(dry).toEqual([
      { productId: pack.id, ok: false, changedFields: [], error: CATALOG_ERROR_CODES.INVALID_INPUT },
    ]);
    expect(dry).toEqual(real);
    expect(await statusOf(pack.id)).toBe('active');
  });

  it('a dry run records no activity row (D2255)', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');

    // Act
    const dry = await bulkEdit({ productIds: [product.id], changes: { status: 'hidden' }, dryRun: true });

    // Assert
    expect(dry[0]).toMatchObject({ ok: true, changedFields: ['status'] });
    expect(await statusOf(product.id)).toBe('active');
    expect(await activityCount(product.id)).toBe(0);
  });

  it('explicit GraphQL nulls for dryRun and the optional changes read as absent (D2255)', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');

    // Act
    const results = await bulkEdit({
      productIds: [product.id],
      changes: { status: 'hidden', price: null, addTagIds: null, removeTagIds: null, collectionIds: null },
      dryRun: null,
    });

    // Assert
    expect(results).toEqual([{ productId: product.id, ok: true, changedFields: ['status'], error: null }]);
    expect(await statusOf(product.id)).toBe('hidden');
  });

  it('two concurrent +500 edits of one product both apply (D2255)', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');
    const plusFiveHundred = { productIds: [product.id], changes: { price: { mode: 'amount', value: 500 } } };

    // Act
    await Promise.all([bulkEdit(plusFiveHundred), bulkEdit(plusFiveHundred)]);

    // Assert
    expect((await suite.kit.product(product.id))?.price).toBe(2000);
  });
});
