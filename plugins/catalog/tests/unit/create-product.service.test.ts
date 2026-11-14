import { CATALOG_WARNING_CODES, productInputSchema, type ProductInput } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import {
  BrandNotFoundError,
  HighlightNotFoundError,
  MediaNotFoundError,
  OrderManagersUnavailableError,
  TagNotFoundError,
  TooManyHighlightsError,
} from '../../domain/errors';
import { FakeOrderManagerCheck } from '../fakes/fake-order-manager-check';
import { ProductWorld } from '../fakes/product-world';
import { brandOf, highlightOf, mediaOf, newId, scopeA, scopeA2, scopeB, tagOf } from '../support/builders';

const base: ProductInput = { title: 'Shirt', status: 'active', price: 2500, sku: 'TS' };
const command = (input: Partial<ProductInput> = {}) => productInputSchema.parse({ ...base, ...input });

describe('CreateProductService', () => {
  let world: ProductWorld;
  let service: CreateProductService;

  beforeEach(() => {
    world = new ProductWorld();
    service = new CreateProductService(world.ports);
  });

  const create = (input: Partial<ProductInput> = {}, scope = scopeA) =>
    service.create(world.ctxOf(scope), scope, command(input));

  it('creates the matrix from options', async () => {
    // Act
    const { product } = await create({
      optionGroups: [
        { name: 'Color', values: ['Red', 'Blue'] },
        { name: 'Size', values: ['S', 'M'] },
      ],
    });

    // Assert
    expect(product.variants.map((variant) => [variant.name, variant.sku])).toEqual([
      ['Shirt - Red / S', 'TS-1'],
      ['Shirt - Red / M', 'TS-2'],
      ['Shirt - Blue / S', 'TS-3'],
      ['Shirt - Blue / M', 'TS-4'],
    ]);
  });

  it('makes one default variant carrying the product sku without options', async () => {
    // Act
    const { product } = await create();

    // Assert
    expect(product.variants.map((variant) => [variant.name, variant.sku, variant.price])).toEqual([
      ['Shirt', 'TS', 2500],
    ]);
  });

  it('returns an old-price warning but saves', async () => {
    // Act
    const { product, warnings } = await create({ oldPrice: 2000 });

    // Assert
    expect(warnings).toEqual([CATALOG_WARNING_CODES.oldPriceBelowPrice]);
    expect(await world.products.findOne(world.ctxOf(scopeA), product.id)).toBeDefined();
  });

  it('saves default settings when none are sent', async () => {
    // Act
    const { product } = await create();

    // Assert
    expect(product.settings).toMatchObject({ soldOut: false, allowOutOfStockOrders: true, orderManagerIds: [] });
    expect(await world.settings.findByProduct(world.ctxOf(scopeA), scopeA, product.id)).toBeDefined();
  });

  it('stores the brand, tags, highlights and collections of its store', async () => {
    // Arrange
    const ctx = world.ctxOf(scopeA);
    const brand = brandOf(scopeA);
    const tag = tagOf(scopeA);
    const highlight = highlightOf(scopeA);
    await world.brands.insert(ctx, scopeA, brand);
    await world.tags.insert(ctx, scopeA, tag);
    await world.highlights.insert(ctx, scopeA, highlight);
    const collectionId = world.products.addCollection(scopeA.storeId);

    // Act
    const { product } = await create({
      brandId: brand.id,
      tagIds: [tag.id],
      highlightIds: [highlight.id],
      collectionIds: [collectionId],
    });

    // Assert
    expect(product).toMatchObject({
      brandId: brand.id,
      tagIds: [tag.id],
      highlightIds: [highlight.id],
      collectionIds: [collectionId],
    });
  });

  it('refuses a foreign brand id as not found', async () => {
    // Arrange
    const foreign = brandOf(scopeB);
    await world.brands.insert(world.ctxOf(scopeB), scopeB, foreign);

    // Act
    const creating = create({ brandId: foreign.id });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(BrandNotFoundError);
    expect(world.products.stored).toEqual([]);
  });

  it("refuses a brand, tag or highlight of the business's other store as not found", async () => {
    // Arrange
    const ctx = world.ctxOf(scopeA2);
    const [brand, tag, highlight] = [brandOf(scopeA2), tagOf(scopeA2), highlightOf(scopeA2)];
    await world.brands.insert(ctx, scopeA2, brand);
    await world.tags.insert(ctx, scopeA2, tag);
    await world.highlights.insert(ctx, scopeA2, highlight);

    // Act / Assert
    await expect(create({ brandId: brand.id })).rejects.toBeInstanceOf(BrandNotFoundError);
    await expect(create({ tagIds: [tag.id] })).rejects.toBeInstanceOf(TagNotFoundError);
    await expect(create({ highlightIds: [highlight.id] })).rejects.toBeInstanceOf(HighlightNotFoundError);
    expect(world.products.stored).toEqual([]);
  });

  it("refuses an image of another business's or another store's media as not found", async () => {
    // Arrange
    const foreign = mediaOf(scopeB);
    const otherStore = mediaOf(scopeA2);
    await world.media.insert(world.ctxOf(scopeB), scopeB, foreign);
    await world.media.insert(world.ctxOf(scopeA2), scopeA2, otherStore);

    // Act / Assert
    await expect(create({ featuredAssetId: foreign.assetId })).rejects.toBeInstanceOf(MediaNotFoundError);
    await expect(create({ assetIds: [otherStore.assetId] })).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it('accepts an image of its own store media', async () => {
    // Arrange
    const own = mediaOf(scopeA);
    await world.media.insert(world.ctxOf(scopeA), scopeA, own);

    // Act
    const { product } = await create({ featuredAssetId: own.assetId, assetIds: [own.assetId] });

    // Assert
    expect(product.featuredAssetId).toBe(own.assetId);
    expect(world.storage.shares).toEqual([`${scopeA.storeId}:${own.assetId}`]);
  });

  it("accepts and shares an image of the business's other store for a caller reaching every store (D2132)", async () => {
    // Arrange
    world.orderManagerChecks.register(new FakeOrderManagerCheck(new Map(), 'all'));
    const otherStore = mediaOf(scopeA2);
    await world.media.insert(world.ctxOf(scopeA2), scopeA2, otherStore);

    // Act
    const { product } = await create({ assetIds: [otherStore.assetId] });

    // Assert
    expect(product.assetIds).toEqual([otherStore.assetId]);
    expect(world.storage.shares).toEqual([`${scopeA.storeId}:${otherStore.assetId}`]);
  });

  it('refuses an image of a store the member does not reach (D2132)', async () => {
    // Arrange
    world.orderManagerChecks.register(new FakeOrderManagerCheck(new Map(), new Set([scopeA.storeId])));
    const otherStore = mediaOf(scopeA2);
    await world.media.insert(world.ctxOf(scopeA2), scopeA2, otherStore);

    // Act / Assert
    await expect(create({ assetIds: [otherStore.assetId] })).rejects.toBeInstanceOf(MediaNotFoundError);
    expect(world.storage.shares).toEqual([]);
  });

  it('refuses seven highlights', async () => {
    // Act
    const creating = service.create(world.ctxOf(scopeA), scopeA, {
      ...command(),
      highlightIds: Array.from({ length: 7 }, () => newId()),
    });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(TooManyHighlightsError);
  });

  it('refuses order managers while no team check is registered (D2114)', async () => {
    // Act
    const creating = create({
      settings: {
        isFragile: false,
        allowParcelOpening: false,
        allowOutOfStockOrders: true,
        soldOut: false,
        quantityRules: { enabled: false, min: 1, step: 1 },
        orderManagerIds: [newId()],
      },
    });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(OrderManagersUnavailableError);
  });

  it('sanitises the description', async () => {
    // Act
    const { product } = await create({ description: '<p>a</p><script>b</script>' });

    // Assert
    expect(product.description).toBe('<p>a</p>');
  });

  it('publishes product.changed once per save, inside the transaction', async () => {
    // Act
    const { product } = await create();

    // Assert
    expect(world.events).toEqual([{ scope: scopeA, productId: product.id, change: 'created' }]);
    expect(world.transactions).toBe(1);
  });
});
