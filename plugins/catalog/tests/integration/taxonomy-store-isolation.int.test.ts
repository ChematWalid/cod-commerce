import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import gql from 'graphql-tag';
import { beforeAll, describe, expect, it } from 'vitest';
import { catalogSuite } from './catalog-kit';
import type { OperationEntry, RouteEntry, TargetIds } from './registry-calls';
import { BRANDS, createTaxonomy, HIGHLIGHTS, TAGS } from './taxonomy-kit';
import { TAXONOMY_OPERATIONS, TAXONOMY_ROUTES } from './taxonomy-registry';

const suite = catalogSuite(1023, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const NO_CODE = 'NO_CODE';

interface ClientErrorShape {
  readonly response?: { readonly errors?: readonly { readonly extensions?: { readonly code?: string } }[] };
}

/** The error code (none on success) and the answer's text of one registry operation. */
async function call(entry: OperationEntry, ids: TargetIds): Promise<{ code: string | undefined; text: string }> {
  try {
    const data = await suite.kit.client.query<Record<string, unknown>>(gql(entry.document), entry.variables(ids));
    return { code: undefined, text: JSON.stringify(data) };
  } catch (error: unknown) {
    const { response } = error as ClientErrorShape;
    return { code: response?.errors?.[0]?.extensions?.code ?? NO_CODE, text: JSON.stringify(response ?? null) };
  }
}

/** Only the taxonomy ids matter here; the product and media ids are never read by these entries. */
const UNUSED = { productId: '', variantId: '', collectionId: '', mediaId: '' };

describe("brands, tags and highlights of A's other store (store isolation inside one business)", () => {
  let ofFirst: TargetIds;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    ofFirst = { ...UNUSED, ...(await createTaxonomy(suite.kit, 'first-only')) };
  });

  const fromSecondStore = async () => {
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a, a.stores[1]);
  };

  it.each(TAXONOMY_OPERATIONS)(
    "$operation from the second store against the first store's entry answers $foreign",
    async (entry) => {
      // Arrange
      await fromSecondStore();
      const id = ofFirst[entry.idField ?? 'brandId'];

      // Act
      const outcome = await call(entry, ofFirst);

      // Assert
      if (entry.foreign === 'not-found') expect(outcome.code).toBe(entry.notFound);
      if (entry.foreign === 'own-only') expect(outcome).toMatchObject({ code: undefined });
      expect(outcome.text).not.toContain(`"${id}"`);
    },
  );

  it.each(TAXONOMY_ROUTES)(
    "$method $route from the second store against the first store's entry answers $foreign",
    async (entry: RouteEntry) => {
      // Arrange
      await fromSecondStore();
      const id = ofFirst[entry.idField ?? 'brandId'];

      // Act
      const answer = await suite.kit.rest(entry.method, entry.url(ofFirst), entry.body?.(ofFirst));

      // Assert
      if (entry.foreign === 'not-found') {
        expect(answer).toMatchObject({ status: 404, body: { code: entry.notFound } });
      }
      if (entry.foreign === 'own-only') expect(answer.status).toBeLessThan(400);
      expect(answer.text).not.toContain(`"${id}"`);
    },
  );

  it("leaves the first store's brand, tag and highlight in place after those calls", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const brands = await suite.kit.gql<{ catalogBrands: { id: string; name: string }[] }>(BRANDS);
    const tags = await suite.kit.gql<{ catalogTags: { id: string; name: string }[] }>(TAGS);
    const highlights = await suite.kit.gql<{ catalogHighlights: { id: string; text: string }[] }>(HIGHLIGHTS);

    // Assert
    expect(brands.catalogBrands).toContainEqual({ id: ofFirst.brandId, name: 'Brand first-only' });
    expect(tags.catalogTags).toContainEqual({ id: ofFirst.tagId, name: 'Tag first-only' });
    expect(highlights.catalogHighlights).toContainEqual({ id: ofFirst.highlightId, text: 'Highlight first-only' });
  });
});
