import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import { describe, expect, it } from 'vitest';
import { catalogSuite, rawId, UPDATE_PRODUCT } from './catalog-kit';
import { syntheticId } from './rows';

const suite = catalogSuite(1022, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const C = CATALOG_ERROR_CODES;

const SETTINGS_FIELDS = `settings {
  nameInDelivery isFragile allowParcelOpening allowOutOfStockOrders soldOut
  quantityRules { enabled min step } orderManagerIds customAttributes { name value }
}`;
const CREATE = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id ${SETTINGS_FIELDS} } }
}`;
const READ = `query ($id: ID!) { catalogProduct(id: $id) { id ${SETTINGS_FIELDS} } }`;

/** Every settings field but the order managers, which need team's check (team's own test covers them). */
const EVERY_FIELD = {
  nameInDelivery: 'Blue shirt',
  isFragile: true,
  allowParcelOpening: true,
  allowOutOfStockOrders: false,
  soldOut: true,
  quantityRules: { enabled: true, min: 2, step: 3 },
  orderManagerIds: [],
  customAttributes: [{ name: 'Material', value: 'Cotton' }],
};

interface SettingsProduct {
  readonly id: string;
  readonly settings: typeof EVERY_FIELD;
}

describe('product settings (AC5)', () => {
  it('saves and reloads every settings field', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { createCatalogProduct } = await suite.kit.gql<{ createCatalogProduct: { product: SettingsProduct } }>(
      CREATE,
      { input: { title: 'Settings', status: 'active', price: 100, settings: EVERY_FIELD } },
    );

    // Act
    const { catalogProduct } = await suite.kit.gql<{ catalogProduct: SettingsProduct }>(READ, {
      id: createCatalogProduct.product.id,
    });

    // Assert
    expect(catalogProduct.settings).toEqual(EVERY_FIELD);
  });

  it('refuses order managers when no check is registered (D2114)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const settings = { ...EVERY_FIELD, orderManagerIds: [syntheticId()] };

    // Act
    const failure = await failureOf(
      suite.kit.gql(CREATE, { input: { title: 'Managed', status: 'active', price: 100, settings } }),
    );

    // Assert
    expect(failure.codes).toEqual([C.ORDER_MANAGERS_UNAVAILABLE]);
  });

  it('refuses a quantity step of zero', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const settings = { ...EVERY_FIELD, quantityRules: { enabled: true, min: 1, step: 0 } };

    // Act
    const failure = await failureOf(
      suite.kit.gql(CREATE, { input: { title: 'Zero step', status: 'active', price: 100, settings } }),
    );

    // Assert
    expect(failure.codes).toEqual([C.INVALID_INPUT]);
  });

  it("answers not found for a settings write on B's product, and writes no row (D2135)", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const ofB = await suite.kit.createProduct({ title: 'B settings' });
    await suite.kit.asOwner(a);

    // Act
    const failure = await failureOf(
      suite.kit.gql(UPDATE_PRODUCT, { id: ofB.id, input: { settings: { isFragile: true } } }),
    );

    // Assert
    expect(failure.codes).toEqual([C.PRODUCT_NOT_FOUND]);
    const rows = await suite.kit.query<{ isFragile: boolean; businessId: string }>(
      'SELECT "isFragile", "businessId" FROM catalog_product_settings WHERE "productId" = $1',
      [rawId(ofB.id)],
    );
    expect(rows).toEqual([{ isFragile: false, businessId: b.businessId }]);
  });
});
