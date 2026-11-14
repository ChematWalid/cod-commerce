import { beforeEach, describe, expect, it } from 'vitest';
import { DemoCatalogSeedService } from '../../application/demo-catalog-seed.service';
import { demoProductsFor } from '../../domain/demo-products';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeB } from '../support/builders';

describe('DemoCatalogSeedService', () => {
  let world: ProductWorld;
  let service: DemoCatalogSeedService;

  beforeEach(() => {
    world = new ProductWorld();
    service = new DemoCatalogSeedService(world.ports);
  });

  const allProducts = async (scope = scopeA) =>
    (await world.products.list(world.ctxOf(scope), { skip: 0, take: 100 })).items;

  it('creates the five demo products of the store language', async () => {
    // Act
    const created = await service.seedStore(world.ctxOf(scopeA), scopeA, 'ar');

    // Assert
    const expected = demoProductsFor('ar');
    expect(created).toEqual(expected.map((spec) => spec.sku));
    const titles = (await allProducts()).map((product) => product.title).sort();
    expect(titles).toEqual(expected.map((spec) => spec.title).sort());
  });

  it('skips a product whose sku already exists in the store', async () => {
    // Arrange
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');
    world.searchHits = (await allProducts()).map((product) => product.id);

    // Act
    const created = await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');

    // Assert
    expect(created).toEqual([]);
    expect(await allProducts()).toHaveLength(5);
  });

  it('links the brand, the tag and three highlights of the branded product', async () => {
    // Act
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');

    // Assert
    const spec = demoProductsFor('en').find((product) => product.brandName !== null);
    const product = (await allProducts()).find((record) => record.sku === spec?.sku);
    const [brand] = await world.brands.list(world.ctxOf(scopeA), scopeA);
    expect(brand?.name).toBe(spec?.brandName);
    expect(product?.brandId).toBe(brand?.id);
    expect(await world.highlights.list(world.ctxOf(scopeA), scopeA)).toHaveLength(3);
    expect(await world.tags.list(world.ctxOf(scopeA), scopeA)).toHaveLength(1);
  });

  it('reuses a brand of the same name a previous run left behind', async () => {
    // Arrange
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');
    const branded = (await allProducts()).find((record) => record.brandId !== null);
    if (branded === undefined) throw new Error('no branded product');
    await world.products.softDelete(world.ctxOf(scopeA), branded.id);
    world.searchHits = (await allProducts()).map((product) => product.id);

    // Act
    const created = await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');

    // Assert
    expect(created).toEqual([branded.sku]);
    expect(await world.brands.list(world.ctxOf(scopeA), scopeA)).toHaveLength(1);
    expect(await world.highlights.list(world.ctxOf(scopeA), scopeA)).toHaveLength(3);
  });

  it('seeds each store on its own', async () => {
    // Act
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');
    const created = await service.seedStore(world.ctxOf(scopeB), scopeB, 'fr');

    // Assert
    expect(created).toHaveLength(5);
    expect(await allProducts(scopeB)).toHaveLength(5);
  });
});
