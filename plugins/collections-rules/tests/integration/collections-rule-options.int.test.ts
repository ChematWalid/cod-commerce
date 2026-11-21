import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { COLLECTIONS_ERROR_CODES } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { refusalOf } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { CollectionsMembers } from './collections-members';
import {
  createBrand,
  createRuleProduct,
  createTag,
  RULE_OPTIONS,
  type RuleOptionsResult,
  burstPastBudget,
} from './collections-rules-api';

const suite = collectionsSuite(1018, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
/** The builder-option budget of one administrator per minute (D2338). */
const RULE_OPTIONS_BUDGET = 30;
const TOO_MANY_REQUESTS = 429;

const ruleOptions = async (): Promise<RuleOptionsResult> =>
  (await suite.kit.gql<{ storeCollectionRuleOptions: RuleOptionsResult }>(RULE_OPTIONS)).storeCollectionRuleOptions;

/** Makes a brand, a tag and a product with a `<label> size` option in the client's active store. */
async function arrangeStore(label: string): Promise<void> {
  const brandId = await createBrand(suite.kit, `${label} brand`);
  const tagId = await createTag(suite.kit, `${label} tag`);
  await createRuleProduct(suite.kit, {
    title: `${label} product`,
    sku: `${label}-P`,
    brandId,
    tagIds: [tagId],
    optionGroups: [{ name: `${label} size`, values: [`${label} S`, `${label} M`] }],
  });
}

describe('the condition builder options (D2321, AC3)', () => {
  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.b);
    await arrangeStore('Bee');
    await suite.kit.asOwner(suite.fixtures.a, suite.fixtures.a.stores[1]);
    await arrangeStore('Second');
    await suite.kit.asOwner(suite.fixtures.a);
    await arrangeStore('Alpha');
  });

  it('lists the brands, tags and option names with values of the active store only, over GraphQL and REST', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const options = await ruleOptions();
    const rest = await suite.kit.rest('GET', '/catalog/collections/rule-options');

    // Assert
    expect(options.brands.map((brand) => brand.name)).toEqual(['Alpha brand']);
    expect(options.tags.map((tag) => tag.name)).toEqual(['Alpha tag']);
    expect(options.options).toEqual([{ name: 'Alpha size', values: ['Alpha M', 'Alpha S'] }]);
    expect(rest.status).toBe(200);
    expect(rest.body).toEqual(options);
    expect(rest.text).not.toMatch(/Bee|Second/);
  });

  it("answers the business's second store with its own names", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a, suite.fixtures.a.stores[1]);

    // Act
    const options = await ruleOptions();

    // Assert
    expect(options.brands.map((brand) => brand.name)).toEqual(['Second brand']);
    expect(JSON.stringify(options)).not.toMatch(/Alpha|Bee/);
  });

  it('a collections-only member reads them', async () => {
    // Arrange
    await new CollectionsMembers(suite.kit).signInAsMember(suite.fixtures.a, ['catalog.collections.view']);

    // Act
    const options = await ruleOptions();

    // Assert
    expect(options.tags.map((tag) => tag.name)).toEqual(['Alpha tag']);
  });

  it('refuses the read past the per-member budget: rate-limited, 429 on REST (D2338)', async () => {
    // Arrange: B's owner has read no option yet; the budget refills one call per two seconds.
    await suite.kit.asOwner(suite.fixtures.b);

    // Act
    const burst = await burstPastBudget(
      RULE_OPTIONS_BUDGET,
      () => refusalOf(suite.kit.gql(RULE_OPTIONS)),
      () => suite.kit.rest('GET', '/catalog/collections/rule-options'),
    );

    // Assert
    const refused = burst.codes.filter((code) => code === COLLECTIONS_ERROR_CODES.RATE_LIMITED).length;
    expect(burst.codes.filter((code) => code !== undefined && code !== COLLECTIONS_ERROR_CODES.RATE_LIMITED)).toEqual(
      [],
    );
    expect(refused).toBeGreaterThanOrEqual(burst.minimumRefused);
    expect(burst.retryAfterSeconds).toBeGreaterThan(0);
    expect(burst.limited?.status).toBe(TOO_MANY_REQUESTS);
    expect(burst.limited?.body).toMatchObject({ code: COLLECTIONS_ERROR_CODES.RATE_LIMITED });
    expect(Number(burst.limited?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
