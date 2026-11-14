import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf } from '@cod/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { catalogSuite, CREATE_PRODUCT } from './catalog-kit';

const suite = catalogSuite(1027, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** Text a database or Vendure fault carries that no client may read (D2136). */
const LEAKS = [/catalog_product_settings/i, /relation/i, /does not exist/i, /QueryFailedError/];

describe('faults reach no client as internal text (D2136)', () => {
  // A table the save writes in the same transaction disappears: a database fault the catalog cannot foresee.
  const breakSettings = () =>
    suite.kit.query('ALTER TABLE "catalog_product_settings" RENAME TO "catalog_product_settings_gone"');
  const repairSettings = () =>
    suite.kit.query('ALTER TABLE IF EXISTS "catalog_product_settings_gone" RENAME TO "catalog_product_settings"');

  afterEach(async () => {
    await repairSettings();
  });

  it('answers a GraphQL fault with INTERNAL_SERVER_ERROR and no internal text', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await breakSettings();

    // Act
    const call = () => suite.kit.gql(CREATE_PRODUCT, { input: { title: 'Fault', status: 'active', price: 1 } });
    const failure = await failureOf(call());
    const raw = JSON.stringify(await call().catch((error: unknown) => error));

    // Assert
    expect(failure.codes).toEqual(['INTERNAL_SERVER_ERROR']);
    for (const leak of LEAKS) expect(raw).not.toMatch(leak);
  });

  it('answers a REST fault with a bare 500 and no internal text', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    await breakSettings();

    // Act
    const answer = await suite.kit.rest('POST', '/catalog/products', { title: 'Fault', status: 'active', price: 1 });

    // Assert
    expect(answer.status).toBe(500);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });

  it('answers a malformed body with the catalog code, never a parser message', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest('POST', '/catalog/products', { title: null, settings: 'x' });

    // Assert
    expect(answer.status).toBe(400);
    expect(answer.body).toMatchObject({ code: 'catalog.invalid-input' });
  });
});
