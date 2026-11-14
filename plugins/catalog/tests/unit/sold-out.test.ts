import {
  CATALOG_MAX_PAGE_SIZE,
  productInputSchema,
  type ProductInput,
  productListQuerySchema,
  productPatchSchema,
  soldOutOrdersInputSchema,
} from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { ListProductsService } from '../../application/list-products.service';
import { SoldOutService } from '../../application/sold-out.service';
import { UpdateProductService } from '../../application/update-product.service';
import type { CoreId } from '../../domain/core-id';
import { isOrderable } from '../../domain/sold-out';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const BASE: ProductInput = { title: 'Lamp', status: 'active', price: 1500, sku: 'LP' };

describe('isOrderable (D2108)', () => {
  it.each([
    [{ soldOut: false, allowOutOfStockOrders: false }, true],
    [{ soldOut: true, allowOutOfStockOrders: true }, true],
    [{ soldOut: true, allowOutOfStockOrders: false }, false],
  ])('%o is orderable: %s', (state, orderable) => {
    // Act / Assert
    expect(isOrderable(state)).toBe(orderable);
  });
});

describe('SoldOutService', () => {
  let world: ProductWorld;
  let service: SoldOutService;

  beforeEach(() => {
    world = new ProductWorld();
    service = new SoldOutService(world.ports);
  });

  /** A product of `scope` titled `title`, marked sold out when `soldOut`. */
  async function productIn(scope = scopeA, title = 'Lamp', soldOut = true): Promise<CoreId> {
    const ctx = world.ctxOf(scope);
    const { product } = await new CreateProductService(world.ports).create(
      ctx,
      scope,
      productInputSchema.parse({ ...BASE, title }),
    );
    if (soldOut) {
      const patch = productPatchSchema.parse({ settings: { soldOut: true } });
      await new UpdateProductService(world.ports).update(ctx, scope, product.id, patch);
    }
    return product.id;
  }

  const stop = (productIds: readonly string[], scope = scopeA) =>
    service.stopOrders(world.ctxOf(scope), scope, soldOutOrdersInputSchema.parse({ productIds }));
  const resume = (productIds: readonly string[], scope = scopeA) =>
    service.resumeOrders(world.ctxOf(scope), scope, soldOutOrdersInputSchema.parse({ productIds }));

  it("lists the active store's sold-out products with their order gating", async () => {
    // Arrange
    const lamp = await productIn(scopeA, 'Lamp');
    await productIn(scopeA, 'Chair', false);
    await productIn(scopeA2, 'Other store lamp');

    // Act
    const listed = await service.list(world.ctxOf(scopeA), scopeA);

    // Assert
    expect(listed).toEqual([{ productId: lamp, title: 'Lamp', allowOutOfStockOrders: true }]);
  });

  it('stop orders makes a sold-out product not orderable', async () => {
    // Arrange
    const lamp = await productIn();

    // Act
    const stopped = await stop([lamp]);

    // Assert
    expect(stopped).toEqual([{ productId: lamp, title: 'Lamp', allowOutOfStockOrders: false }]);
    const settings = await world.settings.findByProduct(world.ctxOf(scopeA), scopeA, lamp);
    expect(settings === undefined ? undefined : isOrderable(settings)).toBe(false);
  });

  it('resume orders makes it orderable again', async () => {
    // Arrange
    const lamp = await productIn();
    await stop([lamp]);

    // Act
    const resumed = await resume([lamp]);

    // Assert
    expect(resumed).toEqual([{ productId: lamp, title: 'Lamp', allowOutOfStockOrders: true }]);
  });

  it('stop with no ids applies to every sold-out product of the active store only', async () => {
    // Arrange
    const lamp = await productIn(scopeA, 'Lamp');
    const chair = await productIn(scopeA, 'Chair', false);
    const otherStore = await productIn(scopeA2, 'Other store lamp');
    const foreign = await productIn(scopeB, 'Foreign lamp');

    // Act
    const stopped = await stop([]);

    // Assert
    expect(stopped.map((product) => product.productId)).toEqual([lamp]);
    for (const [scope, id] of [
      [scopeA, chair],
      [scopeA2, otherStore],
      [scopeB, foreign],
    ] as const) {
      expect((await world.settings.findByProduct(world.ctxOf(scope), scope, id))?.allowOutOfStockOrders).toBe(true);
    }
  });

  it('leaves products that are not sold out, of another store or another business, and malformed ids alone', async () => {
    // Arrange
    const chair = await productIn(scopeA, 'Chair', false);
    const foreign = await productIn(scopeB, 'Foreign lamp');

    // Act
    const stopped = await stop([chair, foreign, 'abc']);

    // Assert
    expect(stopped).toEqual([]);
    const foreignSettings = await world.settings.findByProduct(world.ctxOf(scopeB), scopeB, foreign);
    expect(foreignSettings?.allowOutOfStockOrders).toBe(true);
  });

  it('locks each product it changes inside one transaction and publishes product.changed for it', async () => {
    // Arrange
    const lamp = await productIn();
    world.events.length = 0;
    world.products.calls.length = 0;
    const before = world.transactions;

    // Act
    await stop([lamp]);

    // Assert
    expect(world.transactions).toBe(before + 1);
    expect(world.products.calls).toContain(`lock:${lamp}`);
    expect(world.events).toEqual([{ scope: scopeA, productId: lamp, change: 'updated' }]);
  });

  it('stop with no ids works through every sold-out product in transactions of at most 100 products', async () => {
    // Arrange
    for (let index = 0; index <= CATALOG_MAX_PAGE_SIZE; index += 1) await productIn(scopeA, `Lamp ${String(index)}`);
    world.events.length = 0;
    const before = world.transactions;

    // Act
    const stopped = await stop([]);

    // Assert
    expect(world.transactions).toBe(before + 2);
    expect(stopped).toHaveLength(CATALOG_MAX_PAGE_SIZE + 1);
    expect(world.events).toHaveLength(CATALOG_MAX_PAGE_SIZE + 1);
    expect(stopped.every((product) => !product.allowOutOfStockOrders)).toBe(true);
  });

  it('refuses stop orders with more than 100 ids at the boundary (D2141)', () => {
    // Arrange
    const ids = Array.from({ length: CATALOG_MAX_PAGE_SIZE + 1 }, (_, index) => String(index + 1));

    // Act
    const parsed = soldOutOrdersInputSchema.safeParse({ productIds: ids });

    // Assert
    expect(parsed.success).toBe(false);
  });
});

describe('the sold-out tab of the admin list', () => {
  it("lists only the active store's sold-out products", async () => {
    // Arrange
    const world = new ProductWorld();
    const ctx = world.ctxOf(scopeA);
    const create = (title: string) =>
      new CreateProductService(world.ports).create(ctx, scopeA, productInputSchema.parse({ ...BASE, title }));
    const { product: lamp } = await create('Lamp');
    await create('Chair');
    await new UpdateProductService(world.ports).update(
      ctx,
      scopeA,
      lamp.id,
      productPatchSchema.parse({ settings: { soldOut: true } }),
    );

    // Act
    const page = await new ListProductsService(world.ports).list(
      ctx,
      scopeA,
      productListQuerySchema.parse({ tab: 'sold-out' }),
    );

    // Assert
    expect(page.items.map((item) => item.title)).toEqual(['Lamp']);
    expect(page.totalItems).toBe(1);
  });
});
