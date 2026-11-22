import { beforeEach, describe, expect, it } from 'vitest';
import { DemoCatalogSeedService } from '../../application/demo-catalog-seed.service';
import { type DemoCollectionKey, demoProductsFor } from '../../domain/demo-products';
import { InvalidCatalogInputError } from '../../domain/errors';
import { ProductWorld } from '../fakes/product-world';
import { brandOf, scopeA, scopeA2, scopeB, tagOf } from '../support/builders';

/** A PNG signature and padding: the fake storage keeps any bytes the format check accepts. */
const PNG_BYTES = Uint8Array.from({ length: 64 }, (_, i) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i] ?? 0);

describe('DemoCatalogSeedService', () => {
  let world: ProductWorld;
  let service: DemoCatalogSeedService;

  beforeEach(() => {
    world = new ProductWorld();
    service = new DemoCatalogSeedService(world.ports);
  });

  const allProducts = async (scope = scopeA) =>
    (await world.products.list(world.ctxOf(scope), { skip: 0, take: 100 })).items;

  it('creates the ten demo products of the store language', async () => {
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
    expect(await allProducts()).toHaveLength(10);
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

  it('reuses a brand and a tag whose names differ only by case', async () => {
    // Arrange
    const spec = demoProductsFor('en').find((product) => product.brandName !== null);
    if (spec?.brandName == null) throw new Error('no branded product');
    const [tagName] = spec.tagNames;
    if (tagName === undefined) throw new Error('no tagged product');
    const brand = brandOf(scopeA, spec.brandName.toLowerCase());
    const tag = tagOf(scopeA, tagName.toUpperCase());
    await world.brands.insert(world.ctxOf(scopeA), scopeA, brand);
    await world.tags.insert(world.ctxOf(scopeA), scopeA, tag);

    // Act
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');

    // Assert
    const product = (await allProducts()).find((record) => record.sku === spec.sku);
    expect(product?.brandId).toBe(brand.id);
    expect(await world.brands.list(world.ctxOf(scopeA), scopeA)).toHaveLength(1);
    expect(await world.tags.list(world.ctxOf(scopeA), scopeA)).toEqual([tag]);
  });

  it('seeds a store of business B whatever business A already holds', async () => {
    // Arrange
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');
    const taxonomyOf = async (scope = scopeA) => ({
      brands: await world.brands.list(world.ctxOf(scope), scope),
      tags: await world.tags.list(world.ctxOf(scope), scope),
      highlights: await world.highlights.list(world.ctxOf(scope), scope),
    });
    const before = await taxonomyOf();
    world.searchHits = (await allProducts()).map((product) => product.id);

    // Act
    const created = await service.seedStore(world.ctxOf(scopeB), scopeB, 'en');

    // Assert
    expect(created).toHaveLength(10);
    expect(await allProducts(scopeB)).toHaveLength(10);
    const ofB = await taxonomyOf(scopeB);
    expect(ofB.brands).toHaveLength(1);
    expect(ofB.brands[0]?.id).not.toBe(before.brands[0]?.id);
    expect(ofB.tags).toHaveLength(1);
    expect(ofB.highlights).toHaveLength(3);
    expect(await allProducts()).toHaveLength(10);
    expect(await taxonomyOf()).toEqual(before);
  });

  it('seeds another store of the same business on its own', async () => {
    // Arrange
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en');
    world.searchHits = (await allProducts()).map((product) => product.id);

    // Act
    const created = await service.seedStore(world.ctxOf(scopeA2), scopeA2, 'en');

    // Assert
    expect(created).toHaveLength(10);
    expect(await allProducts(scopeA2)).toHaveLength(10);
    expect(await world.brands.list(world.ctxOf(scopeA2), scopeA2)).toHaveLength(1);
    expect(await allProducts()).toHaveLength(10);
  });

  it("refuses a scope whose store is not the context's channel, before writing anything", async () => {
    // Arrange
    const ctxOfA = world.ctxOf(scopeA);

    // Act
    const seeding = service.seedStore(ctxOfA, scopeA2, 'en');

    // Assert
    await expect(seeding).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(await allProducts()).toEqual([]);
    expect(await world.brands.list(world.ctxOf(scopeA2), scopeA2)).toEqual([]);
  });

  it('uploads the image of each product with an image colour and makes it the featured image', async () => {
    // Arrange
    const asked: string[] = [];
    const imageOf = (color: string): Uint8Array => {
      asked.push(color);
      return PNG_BYTES;
    };

    // Act
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'ar', { imageOf });

    // Assert
    const withImage = demoProductsFor('ar').filter((spec) => spec.imageColor !== null);
    expect(asked).toEqual(withImage.map((spec) => spec.imageColor));
    expect(world.storage.files.size).toBe(withImage.length);
    const products = await allProducts();
    for (const spec of withImage) {
      const product = products.find((record) => record.sku === spec.sku);
      const assetIds = new Set<string>(world.storage.files.keys());
      expect(product?.featuredAssetId, spec.sku).toBeDefined();
      expect(assetIds.has(product?.featuredAssetId ?? ''), spec.sku).toBe(true);
    }
    expect(products.find((record) => record.sku === 'DEMO-MUG')?.featuredAssetId ?? null).toBeNull();
  });

  it('links each product to the demo collections the caller resolved, and to none it did not', async () => {
    // Arrange
    const apparel = world.products.addCollection(scopeA.storeId);
    const collectionIdOf = (key: DemoCollectionKey): string | undefined => (key === 'apparel' ? apparel : undefined);

    // Act
    await service.seedStore(world.ctxOf(scopeA), scopeA, 'en', { collectionIdOf });

    // Assert
    const linked = new Set<string>(world.collections.links.map((link) => link.productId));
    const products = await allProducts();
    for (const spec of demoProductsFor('en')) {
      const product = products.find((record) => record.sku === spec.sku);
      expect(linked.has(product?.id ?? ''), spec.sku).toBe(spec.collectionKeys.includes('apparel'));
    }
    expect(new Set(world.collections.links.map((link) => link.collectionId))).toEqual(new Set([apparel]));
  });
});
