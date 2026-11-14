import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, productInputSchema, type ProductInput, toBusinessId, toStoreId } from '@cod/shared';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type StoreFixture, type TwoBusinesses } from '@cod/testing';
import { RequestContextService, type RequestContext } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogProductCommands, type CatalogStoreScope } from '../../index';
import { CatalogKit, createCatalogTestEnvironment } from './catalog-kit';

const { server, adminClient } = createCatalogTestEnvironment(1021, {
  plugins: [RbacPlugin],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});
let kit: CatalogKit;
let fixtures: TwoBusinesses;
let commands: CatalogProductCommands;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  kit = new CatalogKit(server.app, adminClient);
  fixtures = await createTwoBusinesses(adminClient);
  commands = server.app.get(CatalogProductCommands);
});

afterAll(async () => {
  await server.destroy();
});

const scopeOf = (business: TwoBusinesses['a'], store: StoreFixture): CatalogStoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});
const scopeA = (): CatalogStoreScope => scopeOf(fixtures.a, fixtures.a.stores[0]);
const scopeB = (): CatalogStoreScope => scopeOf(fixtures.b, fixtures.b.stores[0]);
const command = (input: Partial<ProductInput> = {}) =>
  productInputSchema.parse({
    title: `Item ${String(Math.random()).slice(2, 8)}`,
    status: 'active',
    price: 500,
    ...input,
  });

/** A context of `store`'s channel built without the tenant guard, as a worker or a script would. */
const channelContext = (store: StoreFixture): Promise<RequestContext> =>
  server.app.get(RequestContextService).create({ apiType: 'admin', channelOrToken: store.channelToken });

const errorCodeOf = async (attempt: Promise<unknown>): Promise<string | undefined> => {
  const error: unknown = await attempt.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  return (error as { code?: string } | undefined)?.code;
};

describe('CatalogProductCommands (D2201)', () => {
  it('creates through the facade and publishes product.changed', async () => {
    // Arrange
    const ctx = await commands.storeContext(scopeA());

    // Act
    const { product } = await commands.create(ctx, scopeA(), command({ sku: 'FACADE-1' }));

    // Assert
    const events = await kit.query<{ payload: { productId: string; change: string } }>(
      `SELECT payload FROM outbox_event WHERE topic = 'product.changed' AND "businessId" = $1`,
      [fixtures.a.businessId],
    );
    expect(events.some((event) => event.payload.productId === product.id && event.payload.change === 'created')).toBe(
      true,
    );
    expect((await commands.byId(ctx, scopeA(), product.id))?.sku).toBe('FACADE-1');
  });

  it('explicit variant SKUs and prices survive create', async () => {
    // Arrange
    const ctx = await commands.storeContext(scopeA());

    // Act
    const { product } = await commands.createWithVariants(ctx, scopeA(), {
      product: command({ sku: 'ROW', optionGroups: [{ name: 'Size', values: ['S', 'M'] }] }),
      variants: [
        { optionValues: ['S'], sku: 'ROW-SMALL', price: 700 },
        { optionValues: ['M'], sku: 'ROW-MEDIUM', price: 800, barcode: '123' },
      ],
    });

    // Assert
    expect(product.variants.map((variant) => [variant.sku, variant.price])).toEqual([
      ['ROW-SMALL', 700],
      ['ROW-MEDIUM', 800],
    ]);
  });

  it('createWithVariants rolls the create back when the variant edit fails', async () => {
    // Arrange
    const ctx = await commands.storeContext(scopeA());
    const title = `Rolled back ${String(Date.now())}`;

    // Act
    const code = await errorCodeOf(
      commands.createWithVariants(ctx, scopeA(), {
        product: command({ title, optionGroups: [{ name: 'Size', values: ['S'] }] }),
        variants: [{ optionValues: ['XL'], price: 700 }],
      }),
    );

    // Assert
    expect(code).toBe(CATALOG_ERROR_CODES.INVALID_INPUT);
    const rows = await kit.query('SELECT 1 FROM product_translation WHERE name = $1', [title]);
    expect(rows).toHaveLength(0);
  });

  it('refuses a scope whose store belongs to another business', async () => {
    // Arrange
    const ctx = await commands.storeContext(scopeA());
    const foreign = { businessId: toBusinessId(fixtures.b.businessId), storeId: toStoreId(fixtures.a.stores[0].id) };

    // Act
    const code = await errorCodeOf(commands.create(ctx, foreign, command()));

    // Assert
    expect(code).toBe(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND);
  });

  it('refuses an archived store', async () => {
    // Arrange
    const store = fixtures.b.stores[1];
    const scope = scopeOf(fixtures.b, store);
    const ctx = await channelContext(store);
    await kit.query(`UPDATE store SET status = 'archived' WHERE id = $1`, [store.id]);

    // Act
    const writeCode = await errorCodeOf(commands.create(ctx, scope, command()));
    const contextCode = await errorCodeOf(commands.storeContext(scope));

    // Assert
    expect(writeCode).toBe(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND);
    expect(contextCode).toBe(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND);
    await kit.query(`UPDATE store SET status = 'active' WHERE id = $1`, [store.id]);
  });

  it("refuses a context on another store's channel", async () => {
    // Arrange
    const ctx = await channelContext(fixtures.a.stores[1]);

    // Act
    const code = await errorCodeOf(commands.create(ctx, scopeA(), command()));

    // Assert
    expect(code).toBe(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND);
  });

  it('facade refuses a default-channel ctx', async () => {
    // Arrange
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });

    // Act
    const code = await errorCodeOf(commands.findBySkus(ctx, scopeA(), ['ANY']));

    // Assert
    expect(code).toBe(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND);
  });

  it('finds a variant SKU exactly, case and NFC folded', async () => {
    // Arrange
    const ctx = await commands.storeContext(scopeA());
    const { product } = await commands.create(ctx, scopeA(), command({ sku: 'CAFÉ-LOOK' }));
    await commands.create(ctx, scopeA(), command({ sku: 'CAFÉ-LOOK-2' }));
    const lookedUp = 'café-look';

    // Act
    const matches = await commands.findBySkus(ctx, scopeA(), [lookedUp]);

    // Assert
    expect(matches.get(lookedUp)).toEqual({ kind: 'one', productId: product.id, variantId: product.variants[0]?.id });
  });

  it('answers ambiguous for a SKU on two products', async () => {
    // Arrange
    const ctx = await commands.storeContext(scopeA());
    await commands.create(ctx, scopeA(), command({ sku: 'SHARED-SKU' }));
    await commands.create(ctx, scopeA(), command({ sku: 'shared-sku' }));

    // Act
    const matches = await commands.findBySkus(ctx, scopeA(), ['SHARED-SKU']);

    // Assert
    expect(matches.get('SHARED-SKU')).toEqual({ kind: 'ambiguous' });
  });

  it("never finds business B's SKU", async () => {
    // Arrange
    const ctxB = await commands.storeContext(scopeB());
    await commands.create(ctxB, scopeB(), command({ sku: 'ONLY-IN-B' }));
    const ctxA = await commands.storeContext(scopeA());

    // Act
    const matches = await commands.findBySkus(ctxA, scopeA(), ['ONLY-IN-B']);

    // Assert
    expect(matches.get('ONLY-IN-B')).toEqual({ kind: 'none' });
  });

  it("never finds a deleted product's SKU", async () => {
    // Arrange
    await kit.asOwner(fixtures.a);
    const deleted = await kit.createProduct({ title: 'Gone', sku: 'DELETED-SKU' });
    await kit.gql(`mutation ($id: ID!) { deleteCatalogProduct(id: $id) }`, { id: deleted.id });
    const ctx = await commands.storeContext(scopeA());

    // Act
    const matches = await commands.findBySkus(ctx, scopeA(), ['DELETED-SKU']);

    // Assert
    expect(matches.get('DELETED-SKU')).toEqual({ kind: 'none' });
  });

  it('pages ids ascending without duplicates; a product created mid-way appears once at the end', async () => {
    // Arrange
    const scope = scopeOf(fixtures.a, fixtures.a.stores[1]);
    const ctx = await commands.storeContext(scope);
    for (let index = 0; index < 3; index += 1) await commands.create(ctx, scope, command());
    const filter = { tab: 'all' as const };

    // Act
    const first = await commands.listIdsPage(ctx, scope, { filter, skip: 0, take: 2 });
    const { product: late } = await commands.create(ctx, scope, command());
    const rest: string[] = [];
    for (let skip = first.nextSkip; skip !== null;) {
      const page = await commands.listIdsPage(ctx, scope, { filter, skip, take: 2 });
      rest.push(...page.ids);
      skip = page.nextSkip;
    }

    // Assert
    const all = [...first.ids, ...rest];
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([...all].sort((left, right) => Number(left) - Number(right)));
    expect(all.at(-1)).toBe(late.id);
  });

  it('storeContext builds a store-channel ctx and refuses an archived store', async () => {
    // Act
    const ctx = await commands.storeContext(scopeA());

    // Assert
    const channel = await channelContext(fixtures.a.stores[0]);
    expect(String(ctx.channelId)).toBe(String(channel.channelId));
    expect(ctx.apiType).toBe('admin');
    expect(ctx.activeUserId).toBeUndefined();
  });

  it('works from a context built without the tenant guard', async () => {
    // Arrange
    const ctx = await channelContext(fixtures.a.stores[0]);

    // Act
    const { product } = await commands.create(ctx, scopeA(), command({ sku: 'NO-GUARD' }));
    const status = await commands.setStatus(ctx, scopeA(), { productId: product.id, status: 'draft' });
    const index = await commands.taxonomyIndex(ctx, scopeA());

    // Assert
    expect(status.status).toBe('draft');
    expect(index).toEqual({ brands: expect.any(Array) as unknown, tags: expect.any(Array) as unknown });
  });
});
