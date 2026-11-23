import type { StorefrontCollection } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { StorefrontCatalogService } from '../../application/storefront-catalog.service';
import type { ProjectionRow } from '../../domain/projection-row';
import type { StoreScope } from '../../domain/store-scope';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeStorefrontReads, FakeStorefrontStores, STORE_A, STORE_B } from '../fakes/fake-storefront';
import { InMemoryProjectionRepository } from '../fakes/in-memory-projection.repository';

const row = (id: string, overrides: Partial<ProjectionRow> = {}): ProjectionRow => ({
  productId: id,
  slug: `p-${id}`,
  name: `Product ${id}`,
  searchText: `product ${id}`,
  price: Number(id) * 100,
  oldPrice: null,
  imagePath: null,
  visible: true,
  soldOut: false,
  listed: true,
  createdAt: new Date(Number(id) * 1000),
  ...overrides,
});

const COLLECTION: StorefrontCollection = { id: '5', slug: 'robes', title: 'Robes', description: '', imagePath: null };

async function setUp() {
  const stores = new FakeStorefrontStores().add(STORE_A).add(STORE_B);
  const projection = new InMemoryProjectionRepository();
  const reads = new FakeStorefrontReads();
  const service = new StorefrontCatalogService({ stores, projection, reads });
  const write = asOperationContext({});
  const seed = async (scope: StoreScope, rows: ProjectionRow[]) => {
    for (const each of rows) await projection.save(write, scope, each);
  };
  await seed(STORE_A, [row('1'), row('2'), row('3', { listed: false }), row('4')]);
  await seed(STORE_B, [row('9')]);
  return { stores, reads, service, ctxA: stores.contextOf(STORE_A) };
}

describe('StorefrontCatalogService.listProducts', () => {
  it("lists only the context store's listed products, newest first, with internal columns left out", async () => {
    // Arrange
    const { service, ctxA } = await setUp();

    // Act
    const page = await service.listProducts(ctxA, {});

    // Assert
    expect(page?.items.map((item) => item.id)).toEqual(['4', '2', '1']);
    expect(page).toMatchObject({ totalItems: 3, skip: 0, take: 24 });
    expect(Object.keys(page?.items[0] ?? {}).sort()).toEqual(
      ['id', 'imagePath', 'name', 'oldPrice', 'price', 'slug', 'soldOut'].sort(),
    );
  });

  it('pages and orders by price across the whole result, with take clamped', async () => {
    // Arrange
    const { service, ctxA } = await setUp();

    // Act
    const page = await service.listProducts(ctxA, { sort: 'price-desc', skip: '1', take: '1000' });

    // Assert
    expect(page?.items.map((item) => item.id)).toEqual(['2', '1']);
    expect(page).toMatchObject({ skip: 1, take: 48 });
  });

  it("narrows to a visible collection's listed members and answers undefined for an unknown collection", async () => {
    // Arrange
    const { service, reads, ctxA } = await setUp();
    reads.collectionList.push(COLLECTION);
    reads.members.set('5', ['3', '1', '9']);

    // Act
    const inCollection = await service.listProducts(ctxA, { collection: 'robes' });
    const unknown = await service.listProducts(ctxA, { collection: 'nope' });

    // Assert
    expect(inCollection?.items.map((item) => item.id)).toEqual(['1']);
    expect(unknown).toBeUndefined();
  });

  it('answers an empty page for a collection without members', async () => {
    // Arrange
    const { service, reads, ctxA } = await setUp();
    reads.collectionList.push(COLLECTION);
    reads.members.set('5', []);

    // Act
    const page = await service.collectionPage(ctxA, 'robes', {});

    // Assert
    expect(page).toEqual({ collection: COLLECTION, products: { items: [], totalItems: 0, skip: 0, take: 24 } });
  });
});

describe('StorefrontCatalogService.collections', () => {
  it('lists the visible collections the reads answer', async () => {
    // Arrange
    const { service, reads, ctxA } = await setUp();
    reads.collectionList.push(COLLECTION);

    // Act / Assert
    expect(await service.collections(ctxA)).toEqual({ items: [COLLECTION] });
  });
});
