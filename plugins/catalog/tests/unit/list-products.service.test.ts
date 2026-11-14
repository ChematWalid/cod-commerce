import { productInputSchema, productListQuerySchema, type ProductListQueryInput, SLUG_MAX } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { ListProductsService } from '../../application/list-products.service';
import { SlugAvailabilityService } from '../../application/slug-availability.service';
import { InvalidCatalogInputError } from '../../domain/errors';
import { ProductWorld } from '../fakes/product-world';
import { brandOf, scopeA, scopeA2, scopeB, tagOf } from '../support/builders';

describe('ListProductsService', () => {
  let world: ProductWorld;

  const create = async (title: string, extra: Record<string, unknown> = {}, scope = scopeA) => {
    const command = productInputSchema.parse({ title, status: 'active', price: 100, ...extra });
    return (await new CreateProductService(world.ports).create(world.ctxOf(scope), scope, command)).product;
  };
  const list = (query: ProductListQueryInput, scope = scopeA) =>
    new ListProductsService(world.ports).list(world.ctxOf(scope), scope, productListQuerySchema.parse(query));

  beforeEach(() => {
    world = new ProductWorld();
  });

  it('lists only drafts on the draft tab, even with a search term', async () => {
    // Arrange
    const draft = await create('Draft shoe', { status: 'draft' });
    const active = await create('Active shoe');
    world.searchHits = [draft.id, active.id];

    // Act
    const page = await list({ tab: 'draft', q: 'shoe' });

    // Assert
    expect(page.items.map((item) => item.id)).toEqual([draft.id]);
  });

  it('combines the search, brand, tag and collection with AND', async () => {
    // Arrange
    const ctx = world.ctxOf(scopeA);
    const brand = brandOf(scopeA);
    const tag = tagOf(scopeA);
    await world.brands.insert(ctx, scopeA, brand);
    await world.tags.insert(ctx, scopeA, tag);
    const collectionId = world.products.addCollection(scopeA.storeId);
    const all = { brandId: brand.id, tagIds: [tag.id], collectionIds: [collectionId] };
    const match = await create('Match', all);
    const noTag = await create('No tag', { ...all, tagIds: [] });
    const noCollection = await create('No collection', { ...all, collectionIds: [] });
    world.searchHits = [match.id, noTag.id, noCollection.id];

    // Act
    const page = await list({ q: 'x', brandId: brand.id, tagId: tag.id, collectionId });

    // Assert
    expect(page.items.map((item) => item.id)).toEqual([match.id]);
    expect(page.totalItems).toBe(1);
  });

  it("answers an empty list for a filter id of the business's other store, of another business or malformed", async () => {
    // Arrange
    const tag = tagOf(scopeA2);
    await world.tags.insert(world.ctxOf(scopeA2), scopeA2, tag);
    await create('Shoe');

    // Act
    const pages = await Promise.all([
      list({ tagId: tag.id }),
      list({ collectionId: world.products.addCollection(scopeB.storeId) }),
      list({ brandId: 'abc' }),
      list({ collectionId: '1.5' }),
    ]);

    // Assert
    expect(pages.map((page) => page.totalItems)).toEqual([0, 0, 0, 0]);
  });

  it("never lists another store's products", async () => {
    // Arrange
    await create('B shoe', {}, scopeB);

    // Act
    const page = await list({});

    // Assert
    expect(page.items).toEqual([]);
  });
});

describe('SlugAvailabilityService', () => {
  it('reports a slug taken in its store, free in another, and free for the product that holds it', async () => {
    // Arrange
    const world = new ProductWorld();
    const command = productInputSchema.parse({ title: 'حذاء رياضي أحمر', status: 'active', price: 1, slug: 'حذاء' });
    const { product } = await new CreateProductService(world.ports).create(world.ctxOf(scopeA), scopeA, command);
    const service = new SlugAvailabilityService(world.ports);

    // Act
    const taken = await service.check(world.ctxOf(scopeA), 'حذاء'.normalize('NFC'), null);
    const elsewhere = await service.check(world.ctxOf(scopeB), 'حذاء', null);
    const own = await service.check(world.ctxOf(scopeA), 'حذاء', product.id);

    // Assert
    expect(taken.available).toBe(false);
    expect(elsewhere.available).toBe(true);
    expect(own.available).toBe(true);
  });

  it.each([
    ['punctuation only, empty once stored', '???'],
    ['longer than the column once stored as NFD', 'أ'.repeat(SLUG_MAX)],
  ])('refuses a slug a save would refuse: %s', async (_case, slug) => {
    // Arrange
    const world = new ProductWorld();
    const service = new SlugAvailabilityService(world.ports);

    // Act
    const checking = service.check(world.ctxOf(scopeA), slug, null);

    // Assert
    await expect(checking).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });
});
