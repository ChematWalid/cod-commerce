import { describe, expect, it } from 'vitest';
import { ProjectionService } from '../../application/projection.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { ProjectionSource } from '../../domain/ports/projection-source.port';
import type { StoreScope } from '../../domain/store-scope';
import { FakeProjectionSource, FakeStorefrontStores, STORE_A, STORE_B } from '../fakes/fake-storefront';
import { InMemoryProjectionRepository } from '../fakes/in-memory-projection.repository';

const WRITE_CTX = asOperationContext({ transaction: 'delivery' });

const source = (
  id: string,
  overrides: Partial<ProjectionSource['product']> = {},
  soldOut = false,
): ProjectionSource => ({
  product: {
    id,
    slug: `product-${id}`,
    title: `Product ${id}`,
    status: 'active',
    price: 1000,
    oldPrice: null,
    variants: [],
    imagePath: null,
    createdAt: new Date(Number(id) * 1000),
    ...overrides,
  },
  soldOut,
});

function setUp(behaviourA: 'keep' | 'hide' = 'keep') {
  const stores = new FakeStorefrontStores().add(STORE_A, behaviourA).add(STORE_B);
  const catalog = new FakeProjectionSource(stores);
  const projection = new InMemoryProjectionRepository();
  const service = new ProjectionService({ stores, source: catalog, projection });
  return { stores, catalog, projection, service };
}

const ids = (projection: InMemoryProjectionRepository, scope: StoreScope): string[] => [
  ...projection.rowsOf(scope).keys(),
];

describe('ProjectionService.refreshProduct', () => {
  it('writes the row of an active product of the store', async () => {
    // Arrange
    const { catalog, projection, service } = setUp();
    catalog.put(STORE_A, source('7'));

    // Act
    const skip = await service.refreshProduct(WRITE_CTX, STORE_A, '7');

    // Assert
    expect(skip).toBeUndefined();
    expect(projection.rowsOf(STORE_A).get('7')).toMatchObject({ slug: 'product-7', listed: true });
  });

  it('drops the row of a product that became a draft or is gone', async () => {
    // Arrange
    const { catalog, projection, service } = setUp();
    catalog.put(STORE_A, source('7')).put(STORE_A, source('8'));
    await service.refreshProduct(WRITE_CTX, STORE_A, '7');
    await service.refreshProduct(WRITE_CTX, STORE_A, '8');
    catalog.put(STORE_A, source('7', { status: 'draft' }));
    catalog.drop(STORE_A, '8');

    // Act
    await service.refreshProduct(WRITE_CTX, STORE_A, '7');
    await service.refreshProduct(WRITE_CTX, STORE_A, '8');

    // Assert
    expect(ids(projection, STORE_A)).toEqual([]);
  });

  it("never writes when the scope's business does not own the store", async () => {
    // Arrange
    const { catalog, projection, service } = setUp();
    catalog.put(STORE_A, source('7'));
    const forged: StoreScope = { businessId: STORE_B.businessId, storeId: STORE_A.storeId };

    // Act
    const skip = await service.refreshProduct(WRITE_CTX, forged, '7');

    // Assert
    expect(skip).toBe('store-unavailable');
    expect(ids(projection, forged)).toEqual([]);
    expect(catalog.reads).toEqual([]);
  });

  it('skips a store that is unknown or inactive', async () => {
    // Arrange
    const { service, projection } = setUp();
    const gone: StoreScope = { ...STORE_A, storeId: STORE_B.storeId.replace('2', '9') as StoreScope['storeId'] };

    // Act / Assert
    expect(await service.refreshProduct(WRITE_CTX, gone, '7')).toBe('store-unavailable');
    expect(ids(projection, gone)).toEqual([]);
  });
});

describe('ProjectionService.relistStore', () => {
  it("applies the store's current sold-out behaviour to its rows in one relist, reading no product", async () => {
    // Arrange
    const { stores, catalog, projection, service } = setUp('keep');
    catalog.put(STORE_A, source('7', {}, true));
    await service.refreshProduct(WRITE_CTX, STORE_A, '7');
    stores.add(STORE_A, 'hide');
    const readsBefore = catalog.reads.length;

    // Act
    await service.relistStore(WRITE_CTX, STORE_A);

    // Assert
    expect(projection.relists).toEqual([{ scope: STORE_A, soldOutBehavior: 'hide' }]);
    expect(projection.rowsOf(STORE_A).get('7')).toMatchObject({ soldOut: true, listed: false });
    expect(catalog.reads.length).toBe(readsBefore);
  });
});

describe('ProjectionService.backfillIfEmpty', () => {
  it("builds every live product's row of an empty store, page by page, and leaves B alone", async () => {
    // Arrange
    const { catalog, projection, service } = setUp();
    for (let id = 1; id <= 205; id += 1) catalog.put(STORE_A, source(String(id)));
    catalog.put(STORE_A, source('300', { status: 'draft' }));
    catalog.put(STORE_B, source('999'));

    // Act
    const read = await service.backfillIfEmpty(WRITE_CTX, STORE_A);

    // Assert
    expect(read).toBe(206);
    expect(ids(projection, STORE_A)).toHaveLength(205);
    expect(ids(projection, STORE_B)).toEqual([]);
  });

  it('reads nothing for a store that already has rows', async () => {
    // Arrange
    const { catalog, service } = setUp();
    catalog.put(STORE_A, source('7')).put(STORE_A, source('8'));
    await service.refreshProduct(WRITE_CTX, STORE_A, '7');
    const readsBefore = catalog.reads.length;

    // Act
    const read = await service.backfillIfEmpty(WRITE_CTX, STORE_A);

    // Assert
    expect(read).toBe(0);
    expect(catalog.reads.length).toBe(readsBefore);
  });
});
