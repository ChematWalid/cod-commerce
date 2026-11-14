import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES, CATALOG_MAX_PAGE_SIZE } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { catalogSuite, PRODUCT, PRODUCTS, type ProductResult, rawId, UPDATE_PRODUCT } from './catalog-kit';

const suite = catalogSuite(1022, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const FIELDS = 'productId title allowOutOfStockOrders';
const SOLD_OUT = `query { catalogSoldOutProducts { ${FIELDS} } }`;
const STOP = `mutation ($input: CatalogSoldOutOrdersInput!) { stopCatalogSoldOutOrders(input: $input) { ${FIELDS} } }`;
const RESUME = `mutation ($input: CatalogSoldOutOrdersInput!) { resumeCatalogSoldOutOrders(input: $input) { ${FIELDS} } }`;

interface SoldOutRow {
  readonly productId: string;
  readonly title: string;
  readonly allowOutOfStockOrders: boolean;
}

/** A product of the signed-in caller's active store, marked sold out unless `soldOut` is false. */
async function productOf(title: string, soldOut = true): Promise<ProductResult> {
  const product = await suite.kit.createProduct({ title });
  if (soldOut) await suite.kit.gql(UPDATE_PRODUCT, { id: product.id, input: { settings: { soldOut: true } } });
  return product;
}

const gatingOf = async (id: string): Promise<boolean> =>
  (await suite.kit.gql<{ catalogProduct: ProductResult }>(PRODUCT, { id })).catalogProduct.settings
    .allowOutOfStockOrders;

describe('sold-out products and stop / resume orders (AC6, D2108)', () => {
  it('lists the sold-out products of the active store over GraphQL and REST', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const lamp = await productOf('Sold-out lamp');
    const chair = await productOf('Chair in stock', false);

    // Act
    const { catalogSoldOutProducts } = await suite.kit.gql<{ catalogSoldOutProducts: SoldOutRow[] }>(SOLD_OUT);
    const rest = await suite.kit.rest('GET', '/catalog/sold-out-products');

    // Assert
    expect(catalogSoldOutProducts).toContainEqual({
      productId: lamp.id,
      title: 'Sold-out lamp',
      allowOutOfStockOrders: true,
    });
    expect(catalogSoldOutProducts.map((row) => row.productId)).not.toContain(chair.id);
    expect(rest.status).toBe(200);
    expect(rest.body).toContainEqual({
      productId: rawId(lamp.id),
      title: 'Sold-out lamp',
      allowOutOfStockOrders: true,
    });
  });

  it('stop orders makes a sold-out product not orderable, resume orders makes it orderable again', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const lamp = await productOf('Gated lamp');

    // Act
    const stopped = await suite.kit.gql<{ stopCatalogSoldOutOrders: SoldOutRow[] }>(STOP, {
      input: { productIds: [lamp.id] },
    });
    const afterStop = await gatingOf(lamp.id);
    const resumed = await suite.kit.rest('POST', '/catalog/sold-out-products/resume-orders', {
      productIds: [rawId(lamp.id)],
    });

    // Assert
    expect(stopped.stopCatalogSoldOutOrders).toEqual([
      { productId: lamp.id, title: 'Gated lamp', allowOutOfStockOrders: false },
    ]);
    expect(afterStop).toBe(false);
    expect(resumed.status).toBe(200);
    expect(await gatingOf(lamp.id)).toBe(true);
  });

  it('stop with no ids applies to every sold-out product of the active store only', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
    const otherStore = await productOf('Other store lamp');
    await suite.kit.asOwner(a);
    const lamp = await productOf('Every lamp');
    const chair = await productOf('Every chair', false);

    // Act
    await suite.kit.gql(STOP, { input: {} });

    // Assert
    expect(await gatingOf(lamp.id)).toBe(false);
    expect(await gatingOf(chair.id)).toBe(true);
    await suite.kit.asOwner(a, a.stores[1]);
    expect(await gatingOf(otherStore.id)).toBe(true);
    await suite.kit.asOwner(a);
    await suite.kit.gql(RESUME, { input: {} });
    expect(await gatingOf(lamp.id)).toBe(true);
  });

  it("neither lists nor stops another business's sold-out product", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);
    const foreign = await productOf('Foreign lamp');
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const listed = await suite.kit.gql<{ catalogSoldOutProducts: SoldOutRow[] }>(SOLD_OUT);
    const stopped = await suite.kit.gql<{ stopCatalogSoldOutOrders: SoldOutRow[] }>(STOP, {
      input: { productIds: [foreign.id] },
    });
    const restStopped = await suite.kit.rest('POST', '/catalog/sold-out-products/stop-orders', {
      productIds: [rawId(foreign.id)],
    });

    // Assert
    expect(listed.catalogSoldOutProducts.map((row) => row.productId)).not.toContain(foreign.id);
    expect(stopped.stopCatalogSoldOutOrders).toEqual([]);
    expect(restStopped.body).toEqual([]);
    await suite.kit.asOwner(suite.fixtures.b);
    expect(await gatingOf(foreign.id)).toBe(true);
  });

  it('shows the sold-out tab of the admin list', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const lamp = await productOf('Tab lamp');
    const chair = await productOf('Tab chair', false);

    // Act
    const { catalogProducts } = await suite.kit.gql<{ catalogProducts: { items: { id: string }[] } }>(PRODUCTS, {
      options: { tab: 'sold-out', take: CATALOG_MAX_PAGE_SIZE },
    });

    // Assert
    const ids = catalogProducts.items.map((item) => item.id);
    expect(ids).toContain(lamp.id);
    expect(ids).not.toContain(chair.id);
  });

  it('refuses stop orders with more than 100 ids (D2141)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const productIds = Array.from({ length: CATALOG_MAX_PAGE_SIZE + 1 }, (_, index) => String(index + 1));

    // Act
    const failure = await failureOf(suite.kit.gql(STOP, { input: { productIds } }));

    // Assert
    expect(failure.codes).toEqual([CATALOG_ERROR_CODES.INVALID_INPUT]);
  });

  it('refuses a viewer stopping orders', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.signInAsMember(a, ['catalog.products.view'], [a.stores[0]]);

    // Act
    const failure = await failureOf(suite.kit.gql(STOP, { input: {} }));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });
});
