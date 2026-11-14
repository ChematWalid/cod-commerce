import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { type BusinessFixture, failureOf, type StoreFixture } from '@cod/testing';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import { catalogSuite, PRODUCT, type ProductResult, rawId, UPDATE_PRODUCT } from './catalog-kit';
import { insertNameRow, syntheticId } from './rows';

const suite = catalogSuite(1022, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const DEFAULT_CHANNEL_ID = 1;

/** A highlight of `store`, inserted by SQL until Task 12 adds the highlight API. */
async function insertHighlightRow(business: BusinessFixture, store: StoreFixture): Promise<string> {
  const id = syntheticId();
  await suite.kit.query(
    'INSERT INTO "catalog_highlight" ("businessId", "storeId", "id", "text", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, now(), now())',
    [business.businessId, store.id, id, `Highlight ${id}`],
  );
  return id;
}

describe('product create, read, update and delete', () => {
  it('round-trips a product and gives it default settings', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const created = await suite.kit.createProduct({ title: 'Round trip', sku: 'RT', price: 1200 });

    // Act
    const { catalogProduct } = await suite.kit.gql<{ catalogProduct: ProductResult }>(PRODUCT, { id: created.id });
    const { updateCatalogProduct } = await suite.kit.gql<{ updateCatalogProduct: { product: ProductResult } }>(
      UPDATE_PRODUCT,
      { id: created.id, input: { title: 'Renamed', price: 1500 } },
    );
    await suite.kit.gql('mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id: created.id });
    const afterDelete = await suite.kit.gql<{ catalogProduct: ProductResult | null }>(PRODUCT, { id: created.id });

    // Assert
    expect(catalogProduct).toMatchObject({ title: 'Round trip', sku: 'RT', price: 1200, status: 'active' });
    expect(catalogProduct.settings).toMatchObject({ soldOut: false, allowOutOfStockOrders: true, orderManagerIds: [] });
    expect(updateCatalogProduct.product).toMatchObject({ title: 'Renamed', price: 1500 });
    expect(afterDelete.catalogProduct).toBeNull();
  });

  it('writes the product name in the store language whatever the display language (Review Focus 5)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const result = await suite.kit.client.query<{ createCatalogProduct: { product: ProductResult } }>(
      gql(
        'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id title } } }',
      ),
      { input: { title: 'حذاء', status: 'active', price: 10 } },
      { languageCode: 'en' },
    );

    // Assert
    const rows = await suite.kit.query<{ languageCode: string }>(
      'SELECT "languageCode" FROM product_translation WHERE "baseId" = $1',
      [rawId(result.createCatalogProduct.product.id)],
    );
    expect(rows.map((row) => row.languageCode)).toEqual(['ar']);
    expect(result.createCatalogProduct.product.title).toBe('حذاء');
  });

  it('sanitises the description (Review Focus 4)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const product = await suite.kit.createProduct({
      title: 'Sanitised',
      description: '<p onclick="x">a</p><script>b</script><img src=x onerror=y>',
    });

    // Assert
    expect(product.description).toBe('<p>a</p>');
  });

  it('keeps a created product, its variants and options out of the default channel (D2133)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await suite.kit.createProduct({
      title: 'Channel',
      optionGroups: [{ name: 'Size', values: ['S'] }],
    });

    // Act
    const productChannels = await suite.kit.query<{ channelId: number }>(
      'SELECT "channelId" FROM product_channels_channel WHERE "productId" = $1',
      [rawId(product.id)],
    );
    const variantChannels = await suite.kit.query<{ channelId: number }>(
      'SELECT "channelId" FROM product_variant_channels_channel WHERE "productVariantId" = $1',
      [rawId(product.variants[0]?.id ?? '')],
    );

    const [group] = product.optionGroups;
    const groupChannels = await suite.kit.query<{ channelId: number }>(
      'SELECT "channelId" FROM product_option_group_channels_channel WHERE "productOptionGroupId" = $1',
      [rawId(group?.id ?? '')],
    );
    const optionChannels = await suite.kit.query<{ channelId: number }>(
      'SELECT "channelId" FROM product_option_channels_channel WHERE "productOptionId" = $1',
      [rawId(group?.values[0]?.id ?? '')],
    );

    // Assert
    expect(productChannels.map((row) => row.channelId)).not.toContain(DEFAULT_CHANNEL_ID);
    expect(productChannels).toHaveLength(1);
    expect(variantChannels.map((row) => row.channelId)).not.toContain(DEFAULT_CHANNEL_ID);
    expect(groupChannels).toHaveLength(1);
    expect(groupChannels.map((row) => row.channelId)).not.toContain(DEFAULT_CHANNEL_ID);
    expect(optionChannels).toHaveLength(1);
    expect(optionChannels.map((row) => row.channelId)).not.toContain(DEFAULT_CHANNEL_ID);
  });

  it('stores a draft with Vendure enabled off (D2109) and turns it on when active', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await suite.kit.createProduct({ title: 'Draft', status: 'draft' });
    const enabled = async () =>
      (await suite.kit.query<{ enabled: boolean }>('SELECT enabled FROM product WHERE id = $1', [rawId(product.id)]))[0]
        ?.enabled;

    // Act
    const asDraft = await enabled();
    await suite.kit.gql('mutation ($id: ID!) { setCatalogProductStatus(id: $id, status: active) { id } }', {
      id: product.id,
    });

    // Assert
    expect(asDraft).toBe(false);
    expect(await enabled()).toBe(true);
  });

  it("answers collection not found for B's collection id (D2134)", async () => {
    // Arrange
    const collectionOfB = await suite.kit.createCollection(suite.fixtures.b.stores[0]);
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const failure = await failureOf(
      suite.kit.createProduct({ title: 'Foreign collection', collectionIds: [collectionOfB] }),
    );

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND]);
  });

  it("answers not found for a brand, tag or highlight of the business's other store, on create and update", async () => {
    // Arrange
    const { a } = suite.fixtures;
    const brand = await insertNameRow(suite.kit, 'catalog_brand', a, a.stores[1]);
    const tag = await insertNameRow(suite.kit, 'catalog_tag', a, a.stores[1]);
    const highlight = await insertHighlightRow(a, a.stores[1]);
    await suite.kit.asOwner(a);
    const product = await suite.kit.createProduct({ title: 'Other store links' });
    const updating = (input: Record<string, unknown>) =>
      failureOf(suite.kit.gql(UPDATE_PRODUCT, { id: product.id, input }));

    // Act
    const failures = await Promise.all([
      failureOf(suite.kit.createProduct({ title: 'x', brandId: brand })),
      failureOf(suite.kit.createProduct({ title: 'x', tagIds: [tag] })),
      failureOf(suite.kit.createProduct({ title: 'x', highlightIds: [highlight] })),
      updating({ brandId: brand }),
      updating({ tagIds: [tag] }),
      updating({ highlightIds: [highlight] }),
    ]);

    // Assert
    expect(failures.map((failure) => failure.codes)).toEqual([
      [CATALOG_ERROR_CODES.BRAND_NOT_FOUND],
      [CATALOG_ERROR_CODES.TAG_NOT_FOUND],
      [CATALOG_ERROR_CODES.HIGHLIGHT_NOT_FOUND],
      [CATALOG_ERROR_CODES.BRAND_NOT_FOUND],
      [CATALOG_ERROR_CODES.TAG_NOT_FOUND],
      [CATALOG_ERROR_CODES.HIGHLIGHT_NOT_FOUND],
    ]);
  });

  it('returns an old-price warning but saves (AC3)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const result = await suite.kit.gql<{ createCatalogProduct: { warnings: string[] } }>(
      'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { warnings } }',
      { input: { title: 'Warn', status: 'active', price: 2500, oldPrice: 2000 } },
    );

    // Assert
    expect(result.createCatalogProduct.warnings).toEqual(['catalog.old-price-below-price']);
  });

  it('answers 201 to a REST create and the same product to a REST read', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const created = await suite.kit.rest('POST', '/catalog/products', { title: 'Rest', status: 'active', price: 5 });
    const id = (created.body as { product: { id: string } }).product.id;
    const read = await suite.kit.rest('GET', `/catalog/products/${id}`);
    const deleted = await suite.kit.rest('DELETE', `/catalog/products/${id}`);

    // Assert
    expect(created.status).toBe(201);
    expect(read.body).toMatchObject({ id, title: 'Rest' });
    expect(deleted.body).toEqual({ success: true });
  });
});
