import { BARCODE_MAX, INT_COLUMN_MAX, productInputSchema, type ProductInput, SKU_MAX } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { CreateProductWithVariantsService } from '../../application/create-product-with-variants.service';
import { WritePackValuesService } from '../../application/write-pack-values.service';
import { InvalidCatalogInputError, ProductNotFoundError } from '../../domain/errors';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeB } from '../support/builders';

const command = (input: Partial<ProductInput> = {}) =>
  productInputSchema.parse({ title: 'Shirt', status: 'active', price: 1000, ...input });

describe('CreateProductWithVariantsService (D2219)', () => {
  let world: ProductWorld;
  let service: CreateProductWithVariantsService;

  beforeEach(() => {
    world = new ProductWorld();
    service = new CreateProductWithVariantsService(world.ports);
  });

  it("keeps each row's own SKU, price, old price and barcode", async () => {
    // Act
    const { product } = await service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ sku: 'TS', optionGroups: [{ name: 'Size', values: ['S', 'M'] }] }),
      variants: [
        { optionValues: ['s'], sku: 'TS-SMALL', price: 1200, oldPrice: 1500, barcode: '111' },
        { optionValues: ['M'], sku: 'TS-MEDIUM', price: 1300 },
      ],
    });

    // Assert
    expect(product.variants.map((variant) => [variant.optionValues, variant.sku, variant.price])).toEqual([
      [['S'], 'TS-SMALL', 1200],
      [['M'], 'TS-MEDIUM', 1300],
    ]);
    expect(product.variants[0]?.oldPrice).toBe(1500);
    expect(product.variants[0]?.barcode).toBe('111');
  });

  it('runs the create and the variant edit in one outer transaction', async () => {
    // Act
    await service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ optionGroups: [{ name: 'Size', values: ['S'] }] }),
      variants: [{ optionValues: ['S'], price: 900 }],
    });

    // Assert: the outer one, then the create's and the update's, which join it
    expect(world.transactions).toBe(3);
    expect(world.events.map((event) => event.change)).toEqual(['created', 'updated']);
  });

  it('refuses a row whose option values name no variant of the product', async () => {
    // Act
    const creating = service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ optionGroups: [{ name: 'Size', values: ['S'] }] }),
      variants: [{ optionValues: ['XL'], price: 900 }],
    });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it('refuses two rows of one combination', async () => {
    // Act
    const creating = service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ optionGroups: [{ name: 'Size', values: ['S'] }] }),
      variants: [
        { optionValues: ['S'], price: 900 },
        { optionValues: ['s'], price: 950 },
      ],
    });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it.each([
    ['a negative price', { price: -5 }],
    ['a fractional price', { price: 1.5 }],
    ['a price past an int column', { price: INT_COLUMN_MAX + 1 }],
    ['a negative old price', { oldPrice: -1 }],
    ['an over-long SKU', { sku: 'S'.repeat(SKU_MAX + 1) }],
    ['a SKU with a control character', { sku: 'TS\u0000S' }],
    ['a SKU with a bidi override', { sku: 'TS\u202eS' }],
    ['an over-long barcode', { barcode: '1'.repeat(BARCODE_MAX + 1) }],
  ])('refuses a row with %s and saves nothing', async (_case, override) => {
    // Act
    const creating = service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ optionGroups: [{ name: 'Size', values: ['S'] }] }),
      variants: [{ optionValues: ['S'], ...override }],
    });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(world.events).toEqual([]);
  });

  it("trims a row's SKU as the catalog API does", async () => {
    // Act
    const { product } = await service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ optionGroups: [{ name: 'Size', values: ['S'] }] }),
      variants: [{ optionValues: ['S'], sku: '  TS-S  ' }],
    });

    // Assert
    expect(product.variants[0]?.sku).toBe('TS-S');
  });

  it('creates with the plain defaults when no row overrides a variant', async () => {
    // Act
    const { product } = await service.create(world.ctxOf(scopeA), scopeA, {
      product: command({ sku: 'ONE' }),
      variants: [],
    });

    // Assert
    expect(product.variants.map((variant) => [variant.sku, variant.price])).toEqual([['ONE', 1000]]);
    expect(world.events.map((event) => event.change)).toEqual(['created']);
  });
});

describe('WritePackValuesService (D2227)', () => {
  let world: ProductWorld;
  let packs: WritePackValuesService;

  const createPack = async (scope = scopeA) =>
    (await new CreateProductService(world.ports).create(world.ctxOf(scope), scope, command({ type: 'pack' }))).product;

  beforeEach(() => {
    world = new ProductWorld();
    packs = new WritePackValuesService(world.ports);
  });

  it('writes the shared option matrix with a price per common value, and the weight', async () => {
    // Arrange
    const pack = await createPack();

    // Act
    const { product } = await packs.write(world.ctxOf(scopeA), scopeA, {
      productId: pack.id,
      price: 3150,
      weight: 1100,
      sharedOption: {
        name: 'Size',
        values: [
          { value: 'M', price: 3150 },
          { value: 'L', price: 3400 },
        ],
      },
    });

    // Assert
    expect(product.optionGroups.map((group) => [group.name, group.values.map((value) => value.name)])).toEqual([
      ['Size', ['M', 'L']],
    ]);
    expect(product.variants.map((variant) => [variant.optionValues, variant.price])).toEqual([
      [['M'], 3150],
      [['L'], 3400],
    ]);
    expect(product.weight).toBe(1100);
    expect(product.price).toBe(3150);
    expect(world.events.map((event) => event.change)).toEqual(['created', 'updated']);
  });

  it('resets a shared pack to one default variant in per_component mode', async () => {
    // Arrange
    const pack = await createPack();
    const ctx = world.ctxOf(scopeA);
    await packs.write(ctx, scopeA, {
      productId: pack.id,
      price: 3000,
      weight: null,
      sharedOption: { name: 'Size', values: [{ value: 'M', price: 3000 }] },
    });

    // Act
    const { product } = await packs.write(ctx, scopeA, {
      productId: pack.id,
      price: 2500,
      weight: 900,
      sharedOption: null,
    });

    // Assert
    expect(product.optionGroups).toEqual([]);
    expect(product.variants.map((variant) => [variant.optionValues, variant.price])).toEqual([[[], 2500]]);
    expect(product.weight).toBe(900);
  });

  it('refuses a product that is not a pack', async () => {
    // Arrange
    const ctx = world.ctxOf(scopeA);
    const plain = (await new CreateProductService(world.ports).create(ctx, scopeA, command())).product;

    // Act
    const writing = packs.write(ctx, scopeA, { productId: plain.id, price: 1, weight: null, sharedOption: null });

    // Assert
    await expect(writing).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it("answers not found for another business's pack", async () => {
    // Arrange
    const foreign = await createPack(scopeB);

    // Act
    const writing = packs.write(world.ctxOf(scopeA), scopeA, {
      productId: foreign.id,
      price: 1,
      weight: null,
      sharedOption: null,
    });

    // Assert
    await expect(writing).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('refuses a negative price or a weight past an int column', async () => {
    // Arrange
    const pack = await createPack();
    const ctx = world.ctxOf(scopeA);

    // Act
    const negative = packs.write(ctx, scopeA, { productId: pack.id, price: -1, weight: null, sharedOption: null });
    const heavy = packs.write(ctx, scopeA, { productId: pack.id, price: 1, weight: 2 ** 31, sharedOption: null });

    // Assert
    await expect(negative).rejects.toBeInstanceOf(InvalidCatalogInputError);
    await expect(heavy).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });
});
