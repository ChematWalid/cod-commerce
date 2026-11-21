import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { failureOf, rawTestId } from '@cod/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { packInput, packsSuite, SAVE_PACK } from './packs-kit';

const suite = packsSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** Text a database or Vendure fault carries that no client may read (D2136). */
const LEAKS = [/catalog_pack/i, /relation/i, /does not exist/i, /QueryFailedError/, /catalog\./];

describe('pack faults and facade refusals reach no client as internal text (D2136)', () => {
  const breakComponents = () =>
    suite.kit.query('ALTER TABLE "catalog_pack_component" RENAME TO "catalog_pack_component_gone"');
  const repairComponents = () =>
    suite.kit.query('ALTER TABLE IF EXISTS "catalog_pack_component_gone" RENAME TO "catalog_pack_component"');

  afterEach(async () => {
    await repairComponents();
  });

  async function arranged(): Promise<{ pack: string; one: string; two: string }> {
    await suite.kit.asOwner(suite.fixtures.a);
    const one = await suite.kit.createProduct({ title: 'One', price: 10 });
    const two = await suite.kit.createProduct({ title: 'Two', price: 20 });
    const pack = await suite.kit.createPackProduct();
    return { pack: pack.id, one: one.id, two: two.id };
  }

  it('answers a GraphQL fault with INTERNAL_SERVER_ERROR and no internal text', async () => {
    // Arrange
    const ids = await arranged();
    await breakComponents();

    // Act
    const call = () => suite.kit.gql(SAVE_PACK, { id: ids.pack, input: packInput([ids.one, ids.two]) });
    const failure = await failureOf(call());
    const raw = JSON.stringify(await call().catch((error: unknown) => error));

    // Assert
    expect(failure.codes).toEqual(['INTERNAL_SERVER_ERROR']);
    for (const leak of LEAKS) expect(raw).not.toMatch(leak);
  });

  it('answers a REST fault with a bare 500 and no internal text', async () => {
    // Arrange
    const ids = await arranged();
    await breakComponents();

    // Act
    const answer = await suite.kit.rest(
      'PUT',
      `/catalog/packs/${rawTestId(ids.pack)}`,
      packInput([rawTestId(ids.one), rawTestId(ids.two)]),
    );

    // Assert
    expect(answer.status).toBe(500);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });

  it('a pack product deleted before its save answers packs.not-found, no stack or SQL in the body', async () => {
    // Arrange: a pack product deleted between the client's read and its save. Catalog's read answers no product,
    // so the save refuses it itself; the facade's catalog.* translation is covered by catalog-products.adapter.test.ts.
    const ids = await arranged();
    await suite.kit.gql('mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id: ids.pack });

    // Act
    const answer = await suite.kit.rest(
      'PUT',
      `/catalog/packs/${rawTestId(ids.pack)}`,
      packInput([rawTestId(ids.one), rawTestId(ids.two)]),
    );

    // Assert
    expect(answer).toMatchObject({ status: 404, body: { code: 'packs.not-found' } });
    for (const leak of [...LEAKS, /\bat \w+ \(/]) expect(answer.text).not.toMatch(leak);
  });

  it('answers a malformed body with the pack code, never a catalog or parser code', async () => {
    // Arrange
    const ids = await arranged();

    // Act
    const answer = await suite.kit.rest('PUT', `/catalog/packs/${rawTestId(ids.pack)}`, {
      packPricingMode: 'fixed',
      components: [{ productId: { nested: true }, quantity: 1 }],
    });

    // Assert
    expect(answer).toMatchObject({ status: 400, body: { code: 'packs.invalid-input' } });
  });
});
