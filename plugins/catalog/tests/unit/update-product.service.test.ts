import { productInputSchema, type ProductPatchInput, productPatchSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { DeleteProductService } from '../../application/delete-product.service';
import { GetProductService } from '../../application/get-product.service';
import { SetProductStatusService } from '../../application/set-product-status.service';
import { UpdateProductService } from '../../application/update-product.service';
import { MediaNotFoundError, ProductNotFoundError } from '../../domain/errors';
import type { ProductView } from '../../application/product-view';
import { ProductWorld } from '../fakes/product-world';
import { mediaOf, scopeA, scopeB, tagOf } from '../support/builders';

const MATRIX = {
  title: 'Shirt',
  status: 'active',
  price: 2500,
  sku: 'TS',
  optionGroups: [
    { name: 'Color', values: ['Red', 'Blue'] },
    { name: 'Size', values: ['S', 'M'] },
  ],
};

describe('UpdateProductService', () => {
  let world: ProductWorld;
  let service: UpdateProductService;
  let product: ProductView;

  beforeEach(async () => {
    world = new ProductWorld();
    service = new UpdateProductService(world.ports);
    const created = await new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse(MATRIX),
    );
    product = created.product;
    world.events.length = 0;
  });

  const update = (patch: ProductPatchInput, id: string = product.id, scope = scopeA) =>
    service.update(world.ctxOf(scope), scope, id, productPatchSchema.parse(patch));

  it('changes one variant price and keeps the three others', async () => {
    // Arrange
    const [first, ...others] = product.variants;

    // Act
    const { product: saved } = await update({ variants: [{ id: first?.id ?? '', price: 3000 }] });

    // Assert
    expect(saved.variants.map((variant) => variant.price)).toEqual([3000, 2500, 2500, 2500]);
    expect(saved.variants.slice(1)).toEqual(others);
  });

  it('hides one variant', async () => {
    // Arrange
    const target = product.variants[1];

    // Act
    const { product: saved } = await update({ variants: [{ id: target?.id ?? '', isHidden: true }] });

    // Assert
    expect(saved.variants.map((variant) => variant.isHidden)).toEqual([false, true, false, false]);
  });

  it('refuses a variant id of another product as not found', async () => {
    // Arrange
    const other = await new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse({ ...MATRIX, title: 'Other', sku: 'OT' }),
    );
    const foreignVariant = other.product.variants[0]?.id ?? '';

    // Act
    const updating = update({ variants: [{ id: foreignVariant, price: 1 }] });

    // Assert
    await expect(updating).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(other.product.variants[0]?.price).toBe(2500);
  });

  it("refuses a variant image of another business's media as not found", async () => {
    // Arrange
    const foreign = mediaOf(scopeB);
    await world.media.insert(world.ctxOf(scopeB), scopeB, foreign);

    // Act
    const updating = update({ variants: [{ id: product.variants[0]?.id ?? '', featuredAssetId: foreign.assetId }] });

    // Assert
    await expect(updating).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it("answers not found for another store's product and a malformed id", async () => {
    // Act / Assert
    await expect(update({ title: 'x' }, product.id, scopeB)).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(update({ title: 'x' }, 'abc')).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(update({ title: 'x' }, '-1')).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('keeps the planned sku of a new default variant when a removed variant held the product sku', async () => {
    // Arrange: a variant was renamed to the product sku, then every option is removed
    const [first] = product.variants;
    await update({ variants: [{ id: first?.id ?? '', sku: 'TS' }] });

    // Act
    const { product: saved } = await update({ optionGroups: [] });

    // Assert
    expect(saved.variants).toHaveLength(1);
    expect(saved.variants[0]?.sku).not.toBe('TS');
    expect(saved.variants[0]?.sku).toMatch(/^TS-\d+$/);
  });

  it('renames the variants when the title changes, keeping their skus', async () => {
    // Act
    const { product: saved } = await update({ title: 'Tee' });

    // Assert
    expect(saved.variants.map((variant) => [variant.name, variant.sku])[0]).toEqual(['Tee - Red / S', 'TS-1']);
  });

  it('keeps the links it was not sent and replaces those it was', async () => {
    // Arrange
    const tag = tagOf(scopeA);
    await world.tags.insert(world.ctxOf(scopeA), scopeA, tag);
    await update({ tagIds: [tag.id] });

    // Act
    const { product: kept } = await update({ label: 'New' });
    const { product: cleared } = await update({ tagIds: [] });

    // Assert
    expect(kept.tagIds).toEqual([tag.id]);
    expect(cleared.tagIds).toEqual([]);
  });

  it('changes one settings field and keeps the others', async () => {
    // Act
    const { product: saved } = await update({ settings: { isFragile: true, quantityRules: { min: 2 } } });

    // Assert
    expect(saved.settings).toMatchObject({ isFragile: true, allowOutOfStockOrders: true });
    expect(saved.settings.quantityRules).toEqual({ enabled: false, min: 2, step: 1 });
  });

  it('publishes product.changed once per save', async () => {
    // Act
    await update({ label: 'Sale' });

    // Assert
    expect(world.events).toEqual([{ scope: scopeA, productId: product.id, change: 'updated' }]);
  });
});

describe('status, read and delete', () => {
  it('sets the status, reads the product back and deletes it with its settings', async () => {
    // Arrange
    const world = new ProductWorld();
    const ctx = world.ctxOf(scopeA);
    const { product } = await new CreateProductService(world.ports).create(
      ctx,
      scopeA,
      productInputSchema.parse(MATRIX),
    );

    // Act
    const drafted = await new SetProductStatusService(world.ports).set(ctx, scopeA, product.id, 'draft');
    await new DeleteProductService(world.ports).delete(ctx, scopeA, product.id);

    // Assert
    expect(drafted.status).toBe('draft');
    expect(await new GetProductService(world.ports).byId(ctx, scopeA, product.id)).toBeUndefined();
    expect(await world.settings.findByProduct(ctx, scopeA, product.id)).toBeUndefined();
    expect(world.events.map((event) => event.change)).toEqual(['created', 'status', 'deleted']);
  });

  it("does not read or delete another store's product", async () => {
    // Arrange
    const world = new ProductWorld();
    const { product } = await new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse(MATRIX),
    );

    // Act
    const read = await new GetProductService(world.ports).byId(world.ctxOf(scopeB), scopeB, product.id);
    const deleting = new DeleteProductService(world.ports).delete(world.ctxOf(scopeB), scopeB, product.id);

    // Assert
    expect(read).toBeUndefined();
    await expect(deleting).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it.each([
    [
      'update',
      (world: ProductWorld, id: string) =>
        new UpdateProductService(world.ports).update(
          world.ctxOf(scopeA),
          scopeA,
          id,
          productPatchSchema.parse({ label: 'x' }),
        ),
    ],
    [
      'set status',
      (world: ProductWorld, id: string) =>
        new SetProductStatusService(world.ports).set(world.ctxOf(scopeA), scopeA, id, 'hidden'),
    ],
    [
      'delete',
      (world: ProductWorld, id: string) =>
        new DeleteProductService(world.ports).delete(world.ctxOf(scopeA), scopeA, id),
    ],
  ] as const)('locks the product before it reads or writes it on %s', async (_name, write) => {
    // Arrange
    const world = new ProductWorld();
    const { product } = await new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse(MATRIX),
    );
    world.products.calls.length = 0;

    // Act
    await write(world, product.id);

    // Assert
    expect(world.products.calls[0]).toBe(`lock:${product.id}`);
  });
});
