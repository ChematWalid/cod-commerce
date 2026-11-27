import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { normalizeForSearch } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  expectedKeysOf,
  FIXTURE_PRODUCTS,
  FIXTURE_QUERIES,
  RECALL_DEPTH,
  RECALL_TARGET,
  scoreOf,
} from '../fixtures/search-fixture';
import { idsOf, storefrontSuite } from './storefront-kit';

const suite = storefrontSuite(943, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

/** Fixture rows sit far above any product id or row id this database hands out. */
const FIRST_PRODUCT_ID = 800_000;
const FIRST_ROW_ID = 990_000_000_000_000n;
const FIRST_CREATED_AT = Date.UTC(2026, 0, 1);

/** The fixture's stores 0 and 1 are A's two stores (one business, two catalogs), store 2 is B's first. */
const storeIdsOf = (): string[] => [
  suite.fixtures.a.stores[0].id,
  suite.fixtures.a.stores[1].id,
  suite.fixtures.b.stores[0].id,
];

const businessOf = (store: number): string => (store === 2 ? suite.fixtures.b.businessId : suite.fixtures.a.businessId);

/** Writes the 300 fixture names straight into the projection, listed, one statement. */
async function seedFixture(): Promise<void> {
  const stores = storeIdsOf();
  const rows = FIXTURE_PRODUCTS.map((product, index) => ({
    businessId: businessOf(product.store),
    storeId: stores[product.store],
    id: String(FIRST_ROW_ID + BigInt(index)),
    productId: FIRST_PRODUCT_ID + index,
    slug: `fixture-${String(index)}`,
    name: product.name,
    searchText: normalizeForSearch(product.name),
    createdAt: new Date(FIRST_CREATED_AT + index * 1000).toISOString(),
  }));
  await suite.kit.query(
    `INSERT INTO storefront_product ("businessId", "storeId", id, "productId", slug, name, "searchText", price,
       "oldPrice", "imagePath", visible, "soldOut", listed, "createdAt")
     SELECT r."businessId", r."storeId", r.id, r."productId", r.slug, r.name, r."searchText", 1000, NULL, NULL,
       true, false, true, r."createdAt"
       FROM json_to_recordset($1::json) AS r("businessId" bigint, "storeId" bigint, id bigint, "productId" int,
         slug text, name text, "searchText" text, "createdAt" timestamptz)`,
    [JSON.stringify(rows)],
  );
}

/** The fixture key of a product id the API answered, or `foreign:<id>` for a row the fixture never wrote. */
const keyOf = (productId: string): string =>
  FIXTURE_PRODUCTS[Number(productId) - FIRST_PRODUCT_ID]?.key ?? `foreign:${productId}`;

beforeAll(async () => {
  await seedFixture();
});

describe('the storefront search on the spike E fixture (ADR 0014, D3208)', () => {
  it(`reaches recall@${String(RECALL_DEPTH)} of at least ${String(RECALL_TARGET)} with no cross-store hit`, async () => {
    // Arrange
    const stores = storeIdsOf();

    // Act
    const answers = await Promise.all(
      FIXTURE_QUERIES.map(async (query) => {
        const path = `/store/product/search?q=${encodeURIComponent(query.q)}&take=${String(RECALL_DEPTH)}`;
        const answer = await suite.kit.store(path, stores[query.store]);
        return { query, keys: idsOf(answer).map(keyOf) };
      }),
    );

    // Assert
    const scores = answers.map(({ query, keys }) => ({ query, ...scoreOf(expectedKeysOf(query), keys) }));
    const recall = scores.reduce((sum, score) => sum + score.recall, 0) / scores.length;
    const mrr = scores.reduce((sum, score) => sum + score.reciprocalRank, 0) / scores.length;
    const crossStore = answers.flatMap(({ query, keys }) =>
      keys.filter((key) => !key.startsWith(`${String(query.store)}/`)).map((key) => `${query.q} → ${key}`),
    );
    const misses = scores
      .filter((score) => score.recall < 1)
      .map((score) => `${score.query.q} ${String(score.recall)}`);
    process.stdout.write(
      `storefront search: recall@${String(RECALL_DEPTH)} ${recall.toFixed(3)}, MRR ${mrr.toFixed(3)}, ` +
        `${String(scores.length)} queries; below 1: ${misses.join(' | ') || 'none'}\n`,
    );
    expect(crossStore).toEqual([]);
    expect(recall).toBeGreaterThanOrEqual(RECALL_TARGET);
  });
});
