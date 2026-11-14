import { productInputSchema, type ProductInput } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { ProductLookupService } from '../../application/product-lookup.service';
import type { ProductLookupPort } from '../../domain/ports/product-lookup.port';
import { ProductWorld } from '../fakes/product-world';
import { brandOf, scopeA, scopeB, tagOf } from '../support/builders';

describe('ProductLookupService', () => {
  let world: ProductWorld;
  let lookup: ProductLookupService;

  const create = async (input: Partial<ProductInput>, scope = scopeA) => {
    const command = productInputSchema.parse({ title: 'Shirt', status: 'active', price: 100, ...input });
    return (await new CreateProductService(world.ports).create(world.ctxOf(scope), scope, command)).product;
  };

  beforeEach(() => {
    world = new ProductWorld();
    lookup = new ProductLookupService(world.ports);
  });

  it('matches a product SKU held only in defaultSku', async () => {
    // Arrange
    const product = await create({ sku: 'BASE', optionGroups: [{ name: 'Size', values: ['S', 'M'] }] });

    // Act
    const matches = await lookup.findBySkus(world.ctxOf(scopeA), scopeA, ['base']);

    // Assert
    expect(product.variants.map((variant) => variant.sku)).toEqual(['BASE-1', 'BASE-2']);
    expect(matches.get('base')).toEqual({ kind: 'one', productId: product.id, variantId: null });
  });

  it('folds case and NFC after the contains pre-filter', async () => {
    // Arrange
    const exact = await create({ sku: 'CAFÉ-1' });
    await create({ sku: 'CAFÉ-10' });
    const decomposed = 'café-1';

    // Act
    const matches = await lookup.findBySkus(world.ctxOf(scopeA), scopeA, [decomposed, 'missing']);

    // Assert
    const [variant] = exact.variants;
    expect(matches.get(decomposed)).toEqual({ kind: 'one', productId: exact.id, variantId: variant?.id });
    expect(matches.get('missing')).toEqual({ kind: 'none' });
  });

  it('answers ambiguous for a SKU on two variants', async () => {
    // Arrange
    await create({ sku: 'TWIN' });
    await create({ sku: 'twin' });
    await create({ sku: 'TWIN' }, scopeB);

    // Act
    const matches = await lookup.findBySkus(world.ctxOf(scopeA), scopeA, ['TWIN']);

    // Assert
    expect(matches.get('TWIN')).toEqual({ kind: 'ambiguous' });
  });

  it("never matches a SKU held only in another business's store", async () => {
    // Arrange
    await create({ sku: 'ONLY-B' }, scopeB);

    // Act
    const matches = await lookup.findBySkus(world.ctxOf(scopeA), scopeA, ['ONLY-B']);

    // Assert
    expect(matches.get('ONLY-B')).toEqual({ kind: 'none' });
  });

  it('pages ids ascending and dedupes a repeated id', async () => {
    // Arrange
    const first = await create({ title: 'First' });
    const second = await create({ title: 'Second' });
    const third = await create({ title: 'Third' });
    const repeating: ProductLookupPort = {
      findBySkus: (ctx, skus) => world.products.findBySkus(ctx, skus),
      listIds: async (ctx, criteria) => {
        const page = await world.products.listIds(ctx, criteria);
        return { ...page, ids: [...page.ids, ...page.ids] };
      },
    };
    const service = new ProductLookupService({ ...world.ports, lookup: repeating });
    const filter = { tab: 'all' as const };

    // Act
    const page1 = await service.listIdsPage(world.ctxOf(scopeA), scopeA, { filter, skip: 0, take: 2 });
    const page2 = await service.listIdsPage(world.ctxOf(scopeA), scopeA, {
      filter,
      skip: page1.nextSkip ?? 0,
      take: 2,
    });

    // Assert
    expect(page1).toEqual({ ids: [first.id, second.id], nextSkip: 2 });
    expect(page2).toEqual({ ids: [third.id], nextSkip: null });
  });

  it('caps a page at the catalog page size', async () => {
    // Arrange
    await create({ title: 'Only' });

    // Act
    const page = await lookup.listIdsPage(world.ctxOf(scopeA), scopeA, { filter: { tab: 'all' }, skip: 0, take: 1000 });

    // Assert
    expect(world.products.calls).toContain('listIds:0:100');
    expect(page.nextSkip).toBeNull();
  });

  it('answers an empty last page for a malformed tag filter', async () => {
    // Arrange
    await create({ title: 'Only' });

    // Act
    const page = await lookup.listIdsPage(world.ctxOf(scopeA), scopeA, {
      filter: { tab: 'all', tagId: 'not-a-tag' },
      skip: 0,
      take: 10,
    });

    // Assert
    expect(page).toEqual({ ids: [], nextSkip: null });
  });

  it("indexes the store's brands and tags by id and name, never another store's", async () => {
    // Arrange
    const ctx = world.ctxOf(scopeA);
    const brand = brandOf(scopeA, 'Acme');
    const tag = tagOf(scopeA, 'Summer');
    await world.brands.insert(ctx, scopeA, brand);
    await world.tags.insert(ctx, scopeA, tag);
    await world.brands.insert(world.ctxOf(scopeB), scopeB, brandOf(scopeB, 'Other'));

    // Act
    const index = await lookup.taxonomyIndex(ctx, scopeA);

    // Assert
    expect(index).toEqual({ brands: [{ id: brand.id, name: 'Acme' }], tags: [{ id: tag.id, name: 'Summer' }] });
  });
});
