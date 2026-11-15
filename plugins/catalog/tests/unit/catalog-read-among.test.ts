import { COLLECTION_MAX_MANUAL_PRODUCTS, type ProductInput, productInputSchema, productPatchSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogReadService } from '../../application/catalog-read.service';
import { CreateProductService } from '../../application/create-product.service';
import { UpdateProductService } from '../../application/update-product.service';
import { CATALOG_MAX_AMONG_IDS } from '../../domain/constants';
import { type CoreId, toCoreId } from '../../domain/core-id';
import { InvalidCatalogInputError } from '../../domain/errors';
import type { StoreScope } from '../../domain/store-scope';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const PAGE = { skip: 0, take: 20 };

describe('CatalogReadService among given products (D2310)', () => {
  let world: ProductWorld;
  let reads: CatalogReadService;
  const ctx = () => world.ctxOf(scopeA);

  beforeEach(() => {
    world = new ProductWorld();
    reads = new CatalogReadService(world.ports);
    world.openStore(scopeA, 'hide');
  });

  async function product(input: Partial<ProductInput> = {}, scope: StoreScope = scopeA): Promise<CoreId> {
    const { product: created } = await new CreateProductService(world.ports).create(
      world.ctxOf(scope),
      scope,
      productInputSchema.parse({ title: 'Lamp', status: 'active', price: 1500, ...input }),
    );
    return created.id;
  }

  async function soldOut(id: CoreId): Promise<void> {
    await new UpdateProductService(world.ports).update(
      ctx(),
      scopeA,
      id,
      productPatchSchema.parse({ settings: { soldOut: true } }),
    );
  }

  const idsOf = (page: { items: readonly { id: string }[] }): string[] => page.items.map((item) => item.id);

  it('keeps the given order', async () => {
    // Arrange
    const [first, second, third] = [await product(), await product(), await product()];

    // Act
    const page = await reads.listVisibleAmong(ctx(), 'listing', [second, third, first], PAGE);

    // Assert
    expect(idsOf(page)).toEqual([second, third, first]);
  });

  it('leaves drafts out, hidden out of lists, sold-out out when the store hides them', async () => {
    // Arrange
    const active = await product({ title: 'Active' });
    const draft = await product({ title: 'Draft', status: 'draft' });
    const hidden = await product({ title: 'Hidden', status: 'hidden' });
    const gone = await product({ title: 'Sold out' });
    await soldOut(gone);
    const ids = [draft, hidden, gone, active];

    // Act
    const listing = await reads.listVisibleAmong(ctx(), 'listing', ids, PAGE);
    const productPage = await reads.listVisibleAmong(ctx(), 'productPage', ids, PAGE);
    world.openStore(scopeA, 'keep');
    const kept = await reads.listVisibleAmong(ctx(), 'listing', ids, PAGE);

    // Assert
    expect(idsOf(listing)).toEqual([active]);
    expect(idsOf(productPage)).toEqual([active]);
    expect(kept.items.map((item) => [item.id, item.soldOut])).toEqual([
      [gone, true],
      [active, false],
    ]);
  });

  it("counts only visible ids, leaving out other stores' products, unknown, repeated and malformed ids", async () => {
    // Arrange
    const own = [await product(), await product()];
    const draft = await product({ status: 'draft' });
    const otherStore = await product({}, scopeA2);
    const otherBusiness = await product({}, scopeB);
    const ids = [own[0], otherStore, draft, 'abc', own[1], otherBusiness, toCoreId('999999'), own[0]] as CoreId[];

    // Act
    const page = await reads.listVisibleAmong(ctx(), 'listing', ids, { skip: 0, take: 1 });

    // Assert
    expect(page.totalItems).toBe(2);
    expect(idsOf(page)).toEqual([own[0]]);
  });

  it('loads records for the requested page only', async () => {
    // Arrange
    const ids = [await product(), await product(), await product(), await product(), await product()];
    world.products.calls.length = 0;

    // Act
    const page = await reads.listVisibleAmong(ctx(), 'listing', ids, { skip: 1, take: 2 });

    // Assert
    expect(idsOf(page)).toEqual([ids[1], ids[2]]);
    expect(page.totalItems).toBe(5);
    expect(world.products.calls.filter((call) => call.startsWith('findOne:'))).toEqual([
      `findOne:${String(ids[1])}`,
      `findOne:${String(ids[2])}`,
    ]);
  });

  it('refuses 501 ids, a page out of bounds and a context that does not list', async () => {
    // Arrange
    const tooMany = Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS + 1 }, (_, index) =>
      toCoreId(String(index + 1)),
    );
    const one = [await product()];

    // Act
    const reads$ = [
      reads.listVisibleAmong(ctx(), 'listing', tooMany, PAGE),
      reads.listVisibleAmong(ctx(), 'listing', one, { skip: 0, take: 101 }),
      reads.listVisibleAmong(ctx(), 'landingPage' as 'listing', one, PAGE),
      reads.listVisibleAmong(ctx(), 'admin' as 'listing', one, PAGE),
    ];

    // Assert
    for (const read of reads$) await expect(read).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it('answers an empty page for no ids', async () => {
    // Act
    const page = await reads.listVisibleAmong(ctx(), 'listing', [], PAGE);

    // Assert
    expect(page).toEqual({ items: [], totalItems: 0 });
  });
});

describe('CatalogReadService listVisible with productIds (D2310)', () => {
  let world: ProductWorld;
  let reads: CatalogReadService;
  const ctx = () => world.ctxOf(scopeA);

  beforeEach(() => {
    world = new ProductWorld();
    reads = new CatalogReadService(world.ports);
    world.openStore(scopeA, 'keep');
  });

  const product = async (status: 'active' | 'draft' = 'active'): Promise<CoreId> =>
    (
      await new CreateProductService(world.ports).create(
        ctx(),
        scopeA,
        productInputSchema.parse({ title: 'Lamp', status, price: 1500 }),
      )
    ).product.id;

  it('lists only the given visible products, newest first', async () => {
    // Arrange
    const older = await product();
    await product();
    const draft = await product('draft');
    const newer = await product();

    // Act
    const page = await reads.listVisible(ctx(), 'listing', { ...PAGE, productIds: [older, newer, draft] });

    // Assert
    expect(page.items.map((item) => item.id)).toEqual([newer, older]);
    expect(page.totalItems).toBe(2);
  });

  it('answers an empty page for an empty id list and leaves malformed ids out', async () => {
    // Arrange
    const own = await product();

    // Act
    const none = await reads.listVisible(ctx(), 'listing', { ...PAGE, productIds: [] });
    const some = await reads.listVisible(ctx(), 'listing', { ...PAGE, productIds: ['abc', own] as CoreId[] });

    // Assert
    expect(none).toEqual({ items: [], totalItems: 0 });
    expect(some.items.map((item) => item.id)).toEqual([own]);
  });

  it('refuses more than CATALOG_MAX_AMONG_IDS ids', async () => {
    // Arrange
    const tooMany = Array.from({ length: CATALOG_MAX_AMONG_IDS + 1 }, (_, index) => toCoreId(String(index + 1)));

    // Act
    const reading = reads.listVisible(ctx(), 'listing', { ...PAGE, productIds: tooMany });

    // Assert
    await expect(reading).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });
});
