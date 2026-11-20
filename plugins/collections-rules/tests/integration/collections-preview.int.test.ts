import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { codeOf, createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import {
  createRuleProduct,
  createTag,
  PREVIEW,
  previewOf,
  ruleOf,
  tagIs,
  burstPastBudget,
} from './collections-rules-api';

const suite = collectionsSuite(1017, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** The preview budget of one administrator per minute (D2338). */
const PREVIEW_BUDGET = 30;
const TOO_MANY_REQUESTS = 429;

/** How many definitions and member rows exist, read past the API. */
async function tableCounts(): Promise<{ definitions: string; members: string }> {
  const [row] = await suite.kit.query<{ definitions: string; members: string }>(
    `SELECT (SELECT count(*) FROM collections_definition) AS definitions,
            (SELECT count(*) FROM collections_member) AS members`,
  );
  return { definitions: String(row?.definitions), members: String(row?.members) };
}

describe('the live rule preview (D2331, AC4)', () => {
  let promoTag: string;
  let tagOfB: string;
  /** A's promo products, newest first, and its one plain product. */
  let promos: string[];
  let plain: string;

  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.b);
    tagOfB = await createTag(suite.kit, 'promo');
    await createRuleProduct(suite.kit, { title: 'B promo', tagIds: [tagOfB] });
    await suite.kit.asOwner(suite.fixtures.a);
    promoTag = await createTag(suite.kit, 'promo');
    const made: string[] = [];
    for (const title of ['First', 'Second', 'Third', 'Fourth']) {
      made.push((await createRuleProduct(suite.kit, { title, tagIds: [promoTag] })).id);
    }
    promos = made.reverse();
    plain = (await createRuleProduct(suite.kit, { title: 'Plain' })).id;
  });

  beforeEach(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
  });

  it('returns the count of every match and the first page, newest first', async () => {
    // Act
    const page = await previewOf(suite.kit, ruleOf('all', tagIs('is_any_of', promoTag)), { take: 2 });

    // Assert
    expect(page.totalItems).toBe(4);
    expect(page.items.map((item) => item.productId)).toEqual(promos.slice(0, 2));
    expect(page.items[0]).toMatchObject({ title: 'Fourth', status: 'active', price: 100 });
  });

  it('pages with skip and take in productId desc order, over GraphQL and REST', async () => {
    // Act
    const second = await previewOf(suite.kit, ruleOf('all', tagIs('is_any_of', promoTag)), { skip: 2, take: 2 });
    const rest = await suite.kit.rest('POST', '/catalog/collections/preview', {
      rule: ruleOf('all', tagIs('is_any_of', promoTag)),
      skip: 3,
      take: 5,
    });

    // Assert
    expect(second.items.map((item) => item.productId)).toEqual(promos.slice(2, 4));
    expect(rest.status).toBe(200);
    expect(rest.body).toMatchObject({ totalItems: 4, items: [{ productId: rawId(promos[3] ?? '') }] });
  });

  it('does not save: no definition and no member row is written', async () => {
    // Arrange
    await createCollection(suite.kit, { mode: 'automatic', rule: ruleOf('all', tagIs('is_any_of', promoTag)) });
    const before = await tableCounts();

    // Act
    await previewOf(suite.kit, ruleOf('all', tagIs('is_not', promoTag)));

    // Assert
    expect(await tableCounts()).toEqual(before);
  });

  it("matches nothing with B's tag id, and is not [B's tag] keeps every product of A", async () => {
    // Act
    const named = await previewOf(suite.kit, ruleOf('all', tagIs('is_any_of', tagOfB)));
    const notNamed = await previewOf(suite.kit, ruleOf('all', tagIs('is_not', tagOfB)));

    // Assert
    expect(named).toEqual({ totalItems: 0, items: [] });
    expect(notNamed.items.map((item) => item.productId)).toEqual([plain, ...promos]);
  });

  it('refuses an invalid rule with rule-invalid', async () => {
    // Act
    const code = await codeOf(previewOf(suite.kit, ruleOf('all', tagIs('is_any_of', 'not-a-snowflake'))));

    // Assert
    expect(code).toBe(COLLECTIONS_ERROR_CODES.RULE_INVALID);
  });

  it('refuses the preview past the per-member budget: rate-limited, 429 on REST (D2338)', async () => {
    // Arrange: B's owner has spent no preview yet; the budget refills one call per two seconds.
    await suite.kit.asOwner(suite.fixtures.b);
    const rule = ruleOf('all', tagIs('is_any_of', tagOfB));

    // Act
    const burst = await burstPastBudget(
      PREVIEW_BUDGET,
      () => codeOf(suite.kit.gql(PREVIEW, { input: { rule } })),
      () => suite.kit.rest('POST', '/catalog/collections/preview', { rule }),
    );

    // Assert
    const refused = burst.codes.filter((code) => code === COLLECTIONS_ERROR_CODES.RATE_LIMITED).length;
    expect(burst.codes.filter((code) => code !== undefined && code !== COLLECTIONS_ERROR_CODES.RATE_LIMITED)).toEqual(
      [],
    );
    expect(refused).toBeGreaterThanOrEqual(burst.minimumRefused);
    expect(burst.limited?.status).toBe(TOO_MANY_REQUESTS);
    expect(burst.limited?.body).toMatchObject({ code: COLLECTIONS_ERROR_CODES.RATE_LIMITED });
    expect(Number(burst.limited?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
