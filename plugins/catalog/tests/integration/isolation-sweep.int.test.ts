import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogSuite, PRODUCT, type ProductResult, rawId } from './catalog-kit';
import {
  type OperationEntry,
  OPERATION_REGISTRY,
  type RouteEntry,
  ROUTE_REGISTRY,
  type TargetIdField,
  type TargetIds,
} from './endpoint-registry';
import { createMedia, uploadEntry } from './media-kit';
import { createTaxonomy } from './taxonomy-kit';

const suite = catalogSuite(1020, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NOT_FOUND = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999', ''];
const FRACTIONAL_ID = '1.5';
/** Text no answer may carry: SQL, entity names, stacks (D2136). */
const LEAKS = [/select /i, /QueryFailedError/, /ProductVariant\b/, /EntityNotFound/];
const NO_CODE = 'NO_CODE';

interface Outcome {
  readonly code: string | undefined;
  readonly data: unknown;
  readonly text: string;
}

interface ClientErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[] };
}

/** A multipart upload entry's outcome. */
async function uploadOutcome(entry: OperationEntry): Promise<Outcome> {
  const answer = await uploadEntry(suite.kit, entry);
  return { code: answer.code, data: answer.data?.[entry.operation] ?? null, text: answer.text };
}

async function callOperation(entry: OperationEntry, ids: TargetIds): Promise<Outcome> {
  if (entry.upload === true) return uploadOutcome(entry);
  try {
    const data = await suite.kit.client.query<Record<string, unknown>>(gql(entry.document), entry.variables(ids));
    return { code: undefined, data: data[entry.operation], text: JSON.stringify(data) };
  } catch (error: unknown) {
    const { response } = error as ClientErrorShape;
    return {
      code: response?.errors?.[0]?.extensions?.code ?? NO_CODE,
      data: null,
      text: JSON.stringify(response ?? null),
    };
  }
}

/** What the sweep reads of a registry entry. */
interface SweptEntry {
  readonly foreign: string;
  readonly idField?: TargetIdField;
  readonly notFound?: string;
}

const fieldOf = (entry: SweptEntry): TargetIdField => entry.idField ?? 'productId';

/**
 * Whether a malformed id reaches the catalog as written. A product id is a GraphQL `ID`, which this boot's testing
 * strategy `parseInt`s, so `"1.5"` would name engine row 1, whoever owns it. Production's `AutoIncrementIdStrategy`
 * hands over the number 1.5 instead; `tests/unit/production-id-decoding.test.ts` covers that, the REST cells the text.
 */
const reachesCatalogAsSent = (entry: SweptEntry, id: string): boolean =>
  !(id === FRACTIONAL_ID && fieldOf(entry) === 'productId');

/** A's own outcome must not hold B's row: null, not found, or an answer about A's store only. */
function expectForeign(
  entry: SweptEntry,
  outcome: { code: string | undefined; data: unknown; text: string },
  ids: TargetIds,
) {
  if (entry.foreign === 'null') expect(outcome).toMatchObject({ code: undefined, data: null });
  if (entry.foreign === 'not-found') expect(outcome.code).toBe(entry.notFound ?? NOT_FOUND);
  if (entry.foreign === 'own-only') expect(outcome.text).not.toContain(`"${ids[fieldOf(entry)]}"`);
  for (const leak of LEAKS) expect(outcome.text).not.toMatch(leak);
}

/** The product entries: the store-isolation block below aims them at a product of A's first store. */
const isProductEntry = (entry: SweptEntry): boolean => entry.idField === undefined;

describe('catalog isolation sweep (two businesses)', () => {
  let idsOfB: TargetIds;
  let restIdsOfB: TargetIds;

  beforeAll(async () => {
    const { b } = suite.fixtures;
    const collectionId = await suite.kit.createCollection(b.stores[0]);
    await suite.kit.asOwner(b);
    const product = await suite.kit.createProduct({
      title: 'B only',
      slug: 'synthetic-target-slug',
      collectionIds: [`T_${collectionId}`],
      optionGroups: [{ name: 'Size', values: ['S'] }],
    });
    const taxonomy = await createTaxonomy(suite.kit);
    const { id: mediaId } = await createMedia(suite.kit);
    const variantId = product.variants[0]?.id ?? '';
    idsOfB = { productId: product.id, variantId, collectionId: `T_${collectionId}`, mediaId, ...taxonomy };
    restIdsOfB = { productId: rawId(product.id), variantId: rawId(variantId), collectionId, mediaId, ...taxonomy };
  });

  it.each(OPERATION_REGISTRY)("$operation as A against B's ids answers $foreign", async (entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, idsOfB);

    // Assert
    expectForeign(entry, outcome, idsOfB);
  });

  it.each(ROUTE_REGISTRY)("$method $route as A against B's ids answers $foreign", async (entry: RouteEntry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest(entry.method, entry.url(restIdsOfB), entry.body?.(restIdsOfB));
    const code = (answer.body as { code?: string } | null)?.code;

    // Assert
    expectForeign(
      entry,
      { code: answer.status < 400 ? undefined : code, data: answer.body, text: answer.text },
      restIdsOfB,
    );
    if (entry.foreign === 'not-found') expect(answer.status).toBe(404);
  });

  it.each(
    OPERATION_REGISTRY.filter((entry) => entry.byId).flatMap((entry) =>
      MALFORMED_IDS.filter((id) => reachesCatalogAsSent(entry, id)).map((id) => [entry.operation, id, entry] as const),
    ),
  )('%s answers not found for the malformed id "%s"', async (_operation, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const outcome = await callOperation(entry, { ...idsOfB, [fieldOf(entry)]: id });

    // Assert
    expectForeign(entry, outcome, idsOfB);
  });

  it.each(
    ROUTE_REGISTRY.filter((entry) => entry.route.includes(':id')).flatMap((entry) =>
      MALFORMED_IDS.filter((id) => id !== '').map((id) => [entry.method, entry.route, id, entry] as const),
    ),
  )('%s %s answers 404 for the malformed id "%s"', async (_method, _route, id, entry) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const answer = await suite.kit.rest(
      entry.method,
      entry.url({ ...restIdsOfB, [fieldOf(entry)]: encodeURIComponent(id) }),
      entry.body?.(restIdsOfB),
    );

    // Assert
    expect(answer.status).toBe(404);
    for (const leak of LEAKS) expect(answer.text).not.toMatch(leak);
  });

  it.each([
    ["B's channel", (): string => suite.fixtures.b.stores[0].channelToken, 'FORBIDDEN'],
    ['the default channel', (): string => PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN, 'FORBIDDEN'],
    ['an unknown token', (): string => 'synthetic-unknown-channel-token', 'CHANNEL_NOT_FOUND'],
  ] as const)('refuses A on %s', async (_name, token, code) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    suite.kit.client.setChannelToken(token());

    // Act
    const outcome = await callOperation(OPERATION_REGISTRY[0] as OperationEntry, idsOfB);

    // Assert
    expect(outcome.code).toBe(code);
  });

  it('serves B its own product (positive control)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const outcome = await callOperation(OPERATION_REGISTRY[1] as OperationEntry, idsOfB);

    // Assert
    expect(outcome.data).toMatchObject({ id: idsOfB.productId });
  });

  describe("A's other store (store isolation inside one business)", () => {
    let inFirst: ProductResult;

    beforeAll(async () => {
      await suite.kit.asOwner(suite.fixtures.a);
      inFirst = await suite.kit.createProduct({ title: 'First store only', label: 'Original' });
    });

    it.each(OPERATION_REGISTRY.filter((entry) => entry.byId && isProductEntry(entry)))(
      "$operation from A's second store against its first store's product answers $foreign",
      async (entry) => {
        // Arrange
        const { a } = suite.fixtures;
        await suite.kit.asOwner(a, a.stores[1]);

        // Act
        const outcome = await callOperation(entry, { ...idsOfB, productId: inFirst.id });

        // Assert
        expectForeign(entry, outcome, { ...idsOfB, productId: inFirst.id });
      },
    );

    it.each(ROUTE_REGISTRY.filter((entry) => entry.route.includes(':id') && isProductEntry(entry)))(
      "$method $route from A's second store against its first store's product answers 404",
      async (entry: RouteEntry) => {
        // Arrange
        const { a } = suite.fixtures;
        await suite.kit.asOwner(a, a.stores[1]);
        const ids = { ...restIdsOfB, productId: rawId(inFirst.id) };

        // Act
        const answer = await suite.kit.rest(entry.method, entry.url(ids), entry.body?.(ids));

        // Assert
        expect(answer.status).toBe(404);
        expect((answer.body as { code?: string } | null)?.code).toBe(NOT_FOUND);
      },
    );

    it("leaves the first store's product unchanged after those calls", async () => {
      // Arrange
      await suite.kit.asOwner(suite.fixtures.a);

      // Act
      const { catalogProduct } = await suite.kit.gql<{ catalogProduct: ProductResult | null }>(PRODUCT, {
        id: inFirst.id,
      });

      // Assert
      expect(catalogProduct).toMatchObject({ id: inFirst.id, status: 'active', label: 'Original' });
    });
  });
});
