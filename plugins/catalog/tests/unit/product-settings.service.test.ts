import {
  productInputSchema,
  type ProductInput,
  type ProductPatchCommand,
  productPatchSchema,
  type ProductPatchInput,
} from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { GetProductService } from '../../application/get-product.service';
import type { ProductView } from '../../application/product-view';
import { UpdateProductService } from '../../application/update-product.service';
import {
  OrderManagersUnavailableError,
  OrderManagerUnknownError,
  ProductNotFoundError,
  TooManyHighlightsError,
} from '../../domain/errors';
import type { StoreScope } from '../../domain/store-scope';
import { FakeOrderManagerCheck } from '../fakes/fake-order-manager-check';
import { ProductWorld } from '../fakes/product-world';
import { highlightOf, newId, scopeA, scopeA2, scopeB } from '../support/builders';

const MANAGER_ALL = newId();
const MANAGER_SECOND_STORE = newId();
const MANAGER_OF_B = newId();

const EVERY_FIELD = {
  nameInDelivery: 'Blue shirt',
  isFragile: true,
  allowParcelOpening: true,
  allowOutOfStockOrders: false,
  soldOut: true,
  quantityRules: { enabled: true, min: 2, step: 3 },
  orderManagerIds: [MANAGER_ALL],
  customAttributes: [{ name: 'Material', value: 'Cotton' }],
};

describe('product settings and their order managers (AC5, D2114)', () => {
  let world: ProductWorld;
  let check: FakeOrderManagerCheck;

  beforeEach(() => {
    world = new ProductWorld();
    check = new FakeOrderManagerCheck(
      new Map([
        [MANAGER_ALL, { businessId: scopeA.businessId, stores: 'all' as const }],
        [MANAGER_SECOND_STORE, { businessId: scopeA.businessId, stores: [scopeA2.storeId] }],
        [MANAGER_OF_B, { businessId: scopeB.businessId, stores: 'all' as const }],
      ]),
    );
  });

  const create = (input: Partial<ProductInput>, scope: StoreScope = scopeA) =>
    new CreateProductService(world.ports).create(
      world.ctxOf(scope),
      scope,
      productInputSchema.parse({ title: 'Shirt', status: 'active', price: 2500, ...input }),
    );

  const updateWith = (product: ProductView, command: ProductPatchCommand, scope: StoreScope = scopeA) =>
    new UpdateProductService(world.ports).update(world.ctxOf(scope), scope, product.id, command);

  const update = (product: ProductView, patch: ProductPatchInput, scope: StoreScope = scopeA) =>
    updateWith(product, productPatchSchema.parse(patch), scope);

  it('saves and reloads every settings field', async () => {
    // Arrange
    world.orderManagerChecks.register(check);
    const { product } = await create({ settings: EVERY_FIELD });

    // Act
    const reloaded = await new GetProductService(world.ports).byId(world.ctxOf(scopeA), scopeA, product.id);

    // Assert
    expect(reloaded?.settings).toEqual(EVERY_FIELD);
  });

  it('asks the check about the business and the store of the product', async () => {
    // Arrange
    world.orderManagerChecks.register(check);

    // Act
    await create({ settings: EVERY_FIELD });

    // Assert
    expect(check.questions).toEqual([{ businessId: scopeA.businessId, storeId: scopeA.storeId, ids: [MANAGER_ALL] }]);
  });

  it('refuses an order manager of another business', async () => {
    // Arrange
    world.orderManagerChecks.register(check);

    // Act
    const creating = create({ settings: { ...EVERY_FIELD, orderManagerIds: [MANAGER_OF_B] } });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(OrderManagerUnknownError);
  });

  it("refuses an order manager of the business without access to the product's store", async () => {
    // Arrange
    world.orderManagerChecks.register(check);

    // Act
    const creating = create({ settings: { ...EVERY_FIELD, orderManagerIds: [MANAGER_SECOND_STORE] } });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(OrderManagerUnknownError);
    expect(world.products.stored).toEqual([]);
  });

  it('accepts that member on a product of the store it manages', async () => {
    // Arrange
    world.orderManagerChecks.register(check);
    const settings = { ...EVERY_FIELD, orderManagerIds: [MANAGER_SECOND_STORE] };

    // Act
    const { product } = await create({ settings }, scopeA2);

    // Assert
    expect(product.settings.orderManagerIds).toEqual([MANAGER_SECOND_STORE]);
  });

  it('refuses order managers when no check is registered', async () => {
    // Act
    const creating = create({ settings: EVERY_FIELD });

    // Assert
    await expect(creating).rejects.toBeInstanceOf(OrderManagersUnavailableError);
  });

  it('saves settings without order managers when no check is registered', async () => {
    // Act
    const { product } = await create({ settings: { ...EVERY_FIELD, orderManagerIds: [] } });

    // Assert
    expect(product.settings).toMatchObject({ isFragile: true, orderManagerIds: [] });
  });

  it('changes one field of the settings and keeps the others', async () => {
    // Arrange
    world.orderManagerChecks.register(check);
    const { product } = await create({ settings: EVERY_FIELD });

    // Act
    const saved = await update(product, { settings: { isFragile: false, quantityRules: { step: 4 } } });

    // Assert
    expect(saved.product.settings).toEqual({
      ...EVERY_FIELD,
      isFragile: false,
      quantityRules: { enabled: true, min: 2, step: 4 },
    });
  });

  it('refuses a quantity step of zero', () => {
    // Act
    const parsed = productPatchSchema.safeParse({ settings: { quantityRules: { step: 0 } } });

    // Assert
    expect(parsed.success).toBe(false);
  });

  it("answers not found for a settings write on B's product, and writes no row", async () => {
    // Arrange
    const { product } = await create({}, scopeB);
    const rowsBefore = world.settings.rows.length;

    // Act
    const updating = update(product, { settings: { isFragile: true } }, scopeA);

    // Assert
    await expect(updating).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(world.settings.rows.length).toBe(rowsBefore);
  });

  it('keeps highlight order', async () => {
    // Arrange
    const [first, second, third] = [highlightOf(scopeA), highlightOf(scopeA), highlightOf(scopeA)];
    world.highlights.rows.push(first, second, third);
    const { product } = await create({ highlightIds: [first.id, second.id, third.id] });

    // Act
    const saved = await update(product, { highlightIds: [third.id, first.id, second.id] });

    // Assert
    expect(saved.product.highlightIds).toEqual([third.id, first.id, second.id]);
  });

  it('refuses a seventh highlight on a product', async () => {
    // Arrange
    const highlights = Array.from({ length: 7 }, () => highlightOf(scopeA));
    world.highlights.rows.push(...highlights);
    const { product } = await create({});

    // Act: past the API schema, which refuses the same list with the same code (request-body.test.ts)
    const updating = updateWith(product, { highlightIds: highlights.map((highlight) => highlight.id) });

    // Assert
    await expect(updating).rejects.toBeInstanceOf(TooManyHighlightsError);
  });
});
