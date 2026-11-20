import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RateLimiter } from '@cod/plugin-rate-limit';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES, CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES } from '@cod/shared';
import { failureOf, rawTestId } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { BULK_EDIT_RESULT_FIELDS } from './endpoint-registry';
import { importSuite, type ProductResult } from './import-kit';

const suite = importSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const BULK_EDIT = `mutation ($input: CatalogBulkEditInput!) {
  bulkEditCatalogProducts(input: $input) { ${BULK_EDIT_RESULT_FIELDS} }
}`;
const ACTOR_BUDGET = 120;

/** One product's line of a bulk-edit answer. */
interface BulkResult {
  readonly productId: string;
  readonly ok: boolean;
  readonly changedFields: string[];
  readonly error: string | null;
}

async function bulkEdit(input: Record<string, unknown>): Promise<BulkResult[]> {
  const answer = await suite.kit.gql<{ bulkEditCatalogProducts: { results: BulkResult[] } }>(BULK_EDIT, { input });
  return answer.bulkEditCatalogProducts.results;
}

/** As A's owner, `count` active products priced 1 000. */
async function productsOfA(count: number, input: Record<string, unknown> = {}): Promise<ProductResult[]> {
  await suite.kit.asOwner(suite.fixtures.a);
  const products: ProductResult[] = [];
  for (let index = 0; index < count; index += 1) products.push(await suite.kit.createProduct(input));
  return products;
}

const statusOf = async (id: string): Promise<string | undefined> => (await suite.kit.product(id))?.status;

describe('bulk edit (AC4, D2213)', () => {
  it('sets Draft on 3 products and records one activity row each with changedFields', async () => {
    // Arrange
    const products = await productsOfA(3);
    const ids = products.map((product) => product.id);

    // Act
    const results = await bulkEdit({ productIds: ids, changes: { status: 'draft' } });

    // Assert
    expect(results).toEqual(ids.map((productId) => ({ productId, ok: true, changedFields: ['status'], error: null })));
    for (const id of ids) {
      expect(await statusOf(id)).toBe('draft');
      expect(await suite.kit.activityOf(rawTestId(id))).toEqual([
        expect.objectContaining({
          businessId: suite.fixtures.a.businessId,
          storeId: suite.fixtures.a.stores[0].id,
          action: ACTIVITY_ACTIONS.CATALOG_PRODUCTS_BULK_EDITED,
          entityType: ACTIVITY_ENTITY_TYPES.PRODUCT,
          diff: { changedFields: ['status'] },
        }),
      ]);
    }
  });

  it('+10 % updates the product and every variant price', async () => {
    // Arrange
    const [product] = await productsOfA(1, {
      price: 1999,
      optionGroups: [{ name: 'Size', values: ['S', 'M'] }],
    });
    if (product === undefined) throw new Error('no product');

    // Act
    const results = await bulkEdit({ productIds: [product.id], changes: { price: { mode: 'percent', value: 10 } } });
    const after = await suite.kit.product(product.id);

    // Assert
    expect(results[0]).toMatchObject({ ok: true, changedFields: ['price'] });
    expect(after?.price).toBe(2199);
    expect(after?.variants.map((variant) => variant.price)).toEqual([2199, 2199]);
  });

  it('sets brand and adds/removes tags; activity rows list `brand`, `tags`, `price`', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const brand = await suite.kit.createTaxonomy('Brand', 'Bulk brand');
    const kept = await suite.kit.createTaxonomy('Tag', 'Bulk kept');
    const dropped = await suite.kit.createTaxonomy('Tag', 'Bulk dropped');
    const added = await suite.kit.createTaxonomy('Tag', 'Bulk added');
    const [product] = await productsOfA(1, { tagIds: [kept, dropped] });
    if (product === undefined) throw new Error('no product');

    // Act
    const results = await bulkEdit({
      productIds: [product.id],
      changes: { brandId: brand, addTagIds: [added], removeTagIds: [dropped], price: { mode: 'fixed', value: 1500 } },
    });
    const after = await suite.kit.product(product.id);

    // Assert
    expect(results[0]).toMatchObject({ ok: true, changedFields: ['brand', 'tags', 'price'] });
    expect(after).toMatchObject({ brandId: brand, price: 1500 });
    expect([...(after?.tagIds ?? [])].sort()).toEqual([kept, added].sort());
    const [row] = await suite.kit.activityOf(rawTestId(product.id));
    expect(row?.diff).toEqual({ changedFields: ['brand', 'tags', 'price'] });
  });

  it("a price result below 0 is that product's error; the others change", async () => {
    // Arrange
    const [cheap] = await productsOfA(1, { price: 300 });
    const [dear] = await productsOfA(1, { price: 1000 });
    if (cheap === undefined || dear === undefined) throw new Error('no product');

    // Act
    const results = await bulkEdit({
      productIds: [cheap.id, dear.id],
      changes: { price: { mode: 'amount', value: -500 } },
    });

    // Assert
    expect(results).toEqual([
      { productId: cheap.id, ok: false, changedFields: [], error: CATALOG_IMPORT_ERROR_CODES.PRICE_OUT_OF_RANGE },
      { productId: dear.id, ok: true, changedFields: ['price'], error: null },
    ]);
    expect((await suite.kit.product(cheap.id))?.price).toBe(300);
    expect((await suite.kit.product(dear.id))?.price).toBe(500);
  });

  it('a catalog validation error from the facade is a per-product error, never 500', async () => {
    // Arrange: catalog refuses to price a pack (D2227)
    const [pack] = await productsOfA(1, { type: 'pack', price: 0 });
    const [plain] = await productsOfA(1);
    if (pack === undefined || plain === undefined) throw new Error('no product');

    // Act
    const results = await bulkEdit({
      productIds: [pack.id, plain.id],
      changes: { price: { mode: 'fixed', value: 700 } },
    });

    // Assert
    expect(results.map((result) => result.error)).toEqual([CATALOG_ERROR_CODES.INVALID_INPUT, null]);
  });

  it('one foreign id and one deleted id get an identical error, the others change', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const foreign = await suite.kit.createProduct();
    const [deleted, kept] = await productsOfA(2);
    if (deleted === undefined || kept === undefined) throw new Error('no product');
    await suite.kit.gql('mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id: deleted.id });

    // Act
    const results = await bulkEdit({ productIds: [foreign.id, deleted.id, kept.id], changes: { status: 'hidden' } });

    // Assert
    const notFound = { ok: false, changedFields: [], error: CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND };
    expect(results).toEqual([
      { productId: foreign.id, ...notFound },
      { productId: deleted.id, ...notFound },
      { productId: kept.id, ok: true, changedFields: ['status'], error: null },
    ]);
    await suite.kit.asOwner(suite.fixtures.b);
    expect(await statusOf(foreign.id)).toBe('active');
  });

  it.each([
    ['brandId', (id: string) => ({ brandId: id })],
    ['addTagIds', (id: string) => ({ addTagIds: [id] })],
  ] as const)('%s of business B → taxonomy-not-found, nothing written', async (field, changesOf) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const foreign = await suite.kit.createTaxonomy(field === 'brandId' ? 'Brand' : 'Tag', `B ${field}`);
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');

    // Act
    const failure = await failureOf(
      bulkEdit({ productIds: [product.id], changes: { status: 'draft', ...changesOf(foreign) } }),
    );

    // Assert
    expect(failure.codes).toEqual([CATALOG_IMPORT_ERROR_CODES.TAXONOMY_NOT_FOUND]);
    expect(await statusOf(product.id)).toBe('active');
    expect(await suite.kit.activityOf(rawTestId(product.id))).toEqual([]);
  });

  it('the activity row rolls back with a failed product write', async () => {
    // Arrange: the status is written first, then catalog refuses to price the pack (D2227)
    const [pack] = await productsOfA(1, { type: 'pack', price: 0 });
    if (pack === undefined) throw new Error('no product');

    // Act
    const results = await bulkEdit({
      productIds: [pack.id],
      changes: { status: 'draft', price: { mode: 'fixed', value: 700 } },
    });

    // Assert
    expect(results[0]).toMatchObject({ ok: false, error: CATALOG_ERROR_CODES.INVALID_INPUT });
    expect(await statusOf(pack.id)).toBe('active');
    expect(await suite.kit.activityOf(rawTestId(pack.id))).toEqual([]);
  });

  it('dryRun changes nothing and returns the same summary', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');
    const changes = { status: 'draft', price: { mode: 'percent', value: 10 } };

    // Act
    const dry = await bulkEdit({ productIds: [product.id], changes, dryRun: true });
    const untouched = await suite.kit.product(product.id);
    const real = await bulkEdit({ productIds: [product.id], changes });

    // Assert
    expect(untouched).toMatchObject({ status: 'active', price: 1000 });
    expect(dry).toEqual(real);
  });

  it('collectionIds answers collections-unavailable', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');

    // Act
    const failure = await failureOf(bulkEdit({ productIds: [product.id], changes: { collectionIds: ['1'] } }));

    // Assert
    expect(failure.codes).toEqual([CATALOG_IMPORT_ERROR_CODES.COLLECTIONS_UNAVAILABLE]);
  });

  it('a malformed body answers catalog-import.invalid-input over REST, never a catalog code (D2228)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest('POST', '/catalog/products/bulk-edit', {
      productIds: [{ nested: true }],
      changes: { status: 'draft' },
    });

    // Assert
    expect(answer).toMatchObject({ status: 400, body: { code: CATALOG_IMPORT_ERROR_CODES.INVALID_INPUT } });
  });

  it('REST changes the product named by its database id', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');

    // Act
    const answer = await suite.kit.rest('POST', '/catalog/products/bulk-edit', {
      productIds: [rawTestId(product.id)],
      changes: { status: 'hidden' },
    });

    // Assert
    expect(answer).toMatchObject({ status: 200, body: { results: [{ ok: true, changedFields: ['status'] }] } });
    expect(await statusOf(product.id)).toBe('hidden');
  });

  it('needs catalog.products.edit (FORBIDDEN for a view-only member)', async () => {
    // Arrange
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');
    await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.view']);

    // Act
    const failure = await failureOf(bulkEdit({ productIds: [product.id], changes: { status: 'draft' } }));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it('429 after the actor budget, with Retry-After', async () => {
    // Arrange: a member of its own, its budget spent to the last call
    const [product] = await productsOfA(1);
    if (product === undefined) throw new Error('no product');
    const member = await suite.kit.signInAsMember(suite.fixtures.a, ['catalog.products.edit']);
    const [user] = await suite.kit.query<{ id: number }>('SELECT id FROM "user" WHERE identifier = $1', [member.email]);
    const limiter = suite.kit.app.get(RateLimiter);
    const key = `${suite.fixtures.a.businessId}:${String(user?.id)}`;
    for (let spent = 0; spent < ACTOR_BUDGET; spent += 1) await limiter.consume('catalog-bulk-edit-actor', key);

    // Act
    const body = { productIds: [rawTestId(product.id)], changes: { status: 'draft' } };
    const answer = await suite.kit.restRaw(
      'POST',
      '/catalog/products/bulk-edit',
      new TextEncoder().encode(JSON.stringify(body)),
    );

    // Assert
    expect(answer.status).toBe(429);
    expect(Number(answer.headers.get('retry-after'))).toBeGreaterThan(0);
    await suite.kit.asOwner(suite.fixtures.a);
    expect(await statusOf(product.id)).toBe('active');
  });
});
