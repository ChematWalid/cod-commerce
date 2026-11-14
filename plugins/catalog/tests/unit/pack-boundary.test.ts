import { productInputSchema, type ProductPatchInput, productPatchSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { UpdateProductService } from '../../application/update-product.service';
import type { ProductView } from '../../application/product-view';
import { InvalidCatalogInputError } from '../../domain/errors';
import { createsWithinPackBoundary, keepsPackBoundary } from '../../domain/pack-boundary';
import { ProductWorld } from '../fakes/product-world';
import { scopeA } from '../support/builders';

describe('keepsPackBoundary (D2227)', () => {
  it('lets a physical product change any field but its type to pack', () => {
    expect(keepsPackBoundary('physical', { price: 100, type: 'physical' })).toBe(true);
    expect(keepsPackBoundary('physical', { type: 'pack' })).toBe(false);
  });

  it('keeps a pack a pack and its prices read-only', () => {
    expect(keepsPackBoundary('pack', { type: 'pack' })).toBe(true);
    expect(keepsPackBoundary('pack', { type: 'physical' })).toBe(false);
    expect(keepsPackBoundary('pack', { price: 100 })).toBe(false);
    expect(keepsPackBoundary('pack', { oldPrice: null })).toBe(false);
    expect(keepsPackBoundary('pack', { variants: [{ price: 100 }] })).toBe(false);
    expect(keepsPackBoundary('pack', { variants: [{ oldPrice: 100 }] })).toBe(false);
    expect(keepsPackBoundary('pack', { variants: [{}] })).toBe(true);
  });

  it("keeps a pack's variant matrix and weight read-only: catalog-packs computes them", () => {
    expect(keepsPackBoundary('pack', { optionGroups: [] })).toBe(false);
    expect(keepsPackBoundary('pack', { optionGroups: [{ name: 'Size', values: ['S', 'M'] }] })).toBe(false);
    expect(keepsPackBoundary('pack', { weight: 1 })).toBe(false);
    expect(keepsPackBoundary('pack', { weight: null })).toBe(false);
  });

  it('lets a physical product edit its options and weight', () => {
    expect(keepsPackBoundary('physical', { optionGroups: [{ name: 'Size', values: ['S'] }], weight: 1 })).toBe(true);
  });
});

describe('createsWithinPackBoundary (D2227)', () => {
  it('lets a pack be created without options, weight or old price', () => {
    expect(createsWithinPackBoundary({ type: 'pack', optionGroups: [] })).toBe(true);
    expect(createsWithinPackBoundary({ type: 'pack', optionGroups: [], weight: null, oldPrice: null })).toBe(true);
  });

  it('refuses a pack created with options, a weight or an old price: catalog-packs computes them', () => {
    const size = [{ name: 'Size', values: ['S', 'M', 'L'] }];
    expect(createsWithinPackBoundary({ type: 'pack', optionGroups: size })).toBe(false);
    expect(createsWithinPackBoundary({ type: 'pack', optionGroups: [], weight: 500 })).toBe(false);
    expect(createsWithinPackBoundary({ type: 'pack', optionGroups: [], oldPrice: 3000 })).toBe(false);
  });

  it('lets a physical product be created with options, a weight and an old price', () => {
    const size = [{ name: 'Size', values: ['S'] }];
    expect(createsWithinPackBoundary({ type: 'physical', optionGroups: size, weight: 1, oldPrice: 3000 })).toBe(true);
  });
});

describe('CreateProductService and packs (D2227)', () => {
  it('refuses a pack created with a variant matrix and saves nothing', async () => {
    // Arrange
    const world = new ProductWorld();
    const create = new CreateProductService(world.ports);
    const input = { status: 'active', price: 2500, title: 'Duo', type: 'pack' } as const;

    // Act
    const created = create.create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse({ ...input, optionGroups: [{ name: 'Size', values: ['S', 'M', 'L'] }] }),
    );

    // Assert
    await expect(created).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(world.products.stored).toEqual([]);
  });
});

describe('UpdateProductService and packs (D2227)', () => {
  let world: ProductWorld;
  let service: UpdateProductService;
  let pack: ProductView;
  let physical: ProductView;

  beforeEach(async () => {
    world = new ProductWorld();
    service = new UpdateProductService(world.ports);
    const create = new CreateProductService(world.ports);
    const base = { status: 'active', price: 2500 } as const;
    pack = (
      await create.create(
        world.ctxOf(scopeA),
        scopeA,
        productInputSchema.parse({ ...base, title: 'Duo', type: 'pack' }),
      )
    ).product;
    physical = (await create.create(world.ctxOf(scopeA), scopeA, productInputSchema.parse({ ...base, title: 'Mug' })))
      .product;
  });

  const update = (id: string, patch: ProductPatchInput) =>
    service.update(world.ctxOf(scopeA), scopeA, id, productPatchSchema.parse(patch));

  it('refuses turning a physical product into a pack through the catalog API', async () => {
    await expect(update(physical.id, { type: 'pack' })).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it('refuses turning a pack into a physical product', async () => {
    await expect(update(pack.id, { type: 'physical' })).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it("refuses a price edit on a pack, product or variant: catalog-packs owns a pack's price", async () => {
    // Arrange
    const variantId = pack.variants[0]?.id ?? '';

    // Act
    const product = update(pack.id, { price: 1 });
    const variant = update(pack.id, { variants: [{ id: variantId, price: 1 }] });

    // Assert
    await expect(product).rejects.toBeInstanceOf(InvalidCatalogInputError);
    await expect(variant).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it('refuses an options or weight edit on a pack and saves nothing', async () => {
    // Act
    const options = update(pack.id, { optionGroups: [{ name: 'Size', values: ['S', 'M', 'L'] }] });
    const weight = update(pack.id, { weight: 1 });

    // Assert
    await expect(options).rejects.toBeInstanceOf(InvalidCatalogInputError);
    await expect(weight).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(world.products.calls.filter((call) => call.startsWith('update:'))).toEqual([]);
  });

  it('still edits the other fields of a pack', async () => {
    // Act
    const { product } = await update(pack.id, { title: 'Duo deluxe', type: 'pack' });

    // Assert
    expect(product.title).toBe('Duo deluxe');
    expect(product.type).toBe('pack');
  });
});
