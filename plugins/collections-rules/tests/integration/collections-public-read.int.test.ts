import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import {
  NO_ACTIVE_STORE_REFUSAL,
  type ProbedPage,
  CollectionsReadProbePlugin,
} from '../fixtures/public-read-probe.plugin';
import { createCollection, DELETE_COLLECTION, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { SET_COLLECTION_PRODUCTS, UPDATE_PRODUCT } from './collections-products';
import { createRuleProduct, createTag, ruleOf, tagIs } from './collections-rules-api';

const suite = collectionsSuite(1018, {
  plugins: [RbacPlugin, CollectionsReadProbePlugin],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});

const PROBE = '/test/collections-read';

async function probe<T>(route: string): Promise<T> {
  const answer = await suite.kit.rest('GET', `${PROBE}/${route}`);
  expect(answer.status).toBe(200);
  return answer.body as T;
}

const listed = async (): Promise<string[]> => (await probe<ProbedPage>('list')).ids.map(String);
const productsOf = (collectionId: string, context = 'listing') =>
  probe<ProbedPage | null>(`products?id=${rawId(collectionId)}&context=${context}`);

/** A product of the active store as engine id; `status` and other catalog fields may be given. */
const product = async (title: string, input: Readonly<Record<string, unknown>> = {}): Promise<string> =>
  rawId((await createRuleProduct(suite.kit, { title, ...input })).id);

/** A visible manual collection holding `productIds` (engine ids) in that order; returns its GraphQL id. */
async function manualWith(productIds: readonly string[], overrides: Record<string, unknown> = {}): Promise<string> {
  const { id } = await createCollection(suite.kit, overrides);
  if (productIds.length > 0) {
    await suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: productIds.map((productId) => `T_${productId}`) });
  }
  return id;
}

/** Sets the sold-out behaviour of `storeId` as the store settings screen would. */
const behave = (storeId: string, behaviour: 'keep' | 'hide') =>
  suite.kit.query(`UPDATE "store" SET "soldOutBehavior" = $1 WHERE "id" = $2`, [behaviour, storeId]);

describe('CollectionsReadService on a live server (AC6, D2316)', () => {
  it('a hidden collection is not listed and its products read undefined', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const shown = await manualWith([await product('Read shown')]);
    const hidden = await manualWith([await product('Read hidden')], { visible: false });

    // Act
    const ids = await listed();
    const hiddenProducts = await productsOf(hidden);

    // Assert
    expect(ids).toContain(rawId(shown));
    expect(ids).not.toContain(rawId(hidden));
    expect(hiddenProducts).toBeNull();
  });

  it('position orders the list', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a, suite.fixtures.a.stores[1]);
    const late = await manualWith([], { position: 30 });
    const early = await manualWith([], { position: 10 });
    const middle = await manualWith([], { position: 20 });

    // Act
    const ids = await listed();

    // Assert
    expect(ids).toEqual([early, middle, late].map(rawId));
  });

  it('manual products keep their order in productsOf', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const [first, second, third] = [await product('Order 1'), await product('Order 2'), await product('Order 3')];
    const collectionId = await manualWith([second, third, first]);

    // Act
    const page = await productsOf(collectionId);

    // Assert
    expect(page).toEqual({ ids: [second, third, first], totalItems: 3 });
  });

  it('automatic products read newest first', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const tag = await createTag(suite.kit, 'read-newest');
    const [older, newer] = [await product('Newest 1', { tagIds: [tag] }), await product('Newest 2', { tagIds: [tag] })];
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', tag)),
    });

    // Act
    const page = await productsOf(id);

    // Assert
    expect(page).toEqual({ ids: [newer, older], totalItems: 2 });
  });

  it('draft products never appear, hidden products stay out of the list, sold-out follows the store setting', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);
    const active = await product('Visibility active');
    const draft = await product('Visibility draft', { status: 'draft' });
    const hidden = await product('Visibility hidden', { status: 'hidden' });
    const soldOut = await product('Visibility sold out');
    await suite.kit.gql(UPDATE_PRODUCT, { id: `T_${soldOut}`, input: { settings: { soldOut: true } } });
    const collectionId = await manualWith([soldOut, draft, active, hidden]);

    // Act
    await behave(a.stores[0].id, 'keep');
    const kept = await productsOf(collectionId);
    await behave(a.stores[0].id, 'hide');
    const hiddenSoldOut = await productsOf(collectionId);
    await behave(a.stores[0].id, 'keep');

    // Assert
    expect(kept).toEqual({ ids: [soldOut, active], totalItems: 2 });
    expect(hiddenSoldOut).toEqual({ ids: [active], totalItems: 1 });
  });

  it("B's collection id reads undefined for A, and A's other store's too", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const foreign = await manualWith([await product('Foreign read')]);
    await suite.kit.asOwner(a, a.stores[1]);
    const otherStore = await manualWith([await product('Other store read')]);
    await suite.kit.asOwner(a);

    // Act
    const answers = [await productsOf(foreign), await productsOf(otherStore)];
    const ids = await listed();

    // Assert
    expect(answers).toEqual([null, null]);
    expect(ids).not.toContain(rawId(foreign));
    expect(ids).not.toContain(rawId(otherStore));
  });

  it('a context on another channel than the store is refused, and one without a tenant too', async () => {
    // Arrange
    const { a } = suite.fixtures;
    await suite.kit.asOwner(a);

    // Act
    const otherChannel = await suite.kit.rest('GET', `${PROBE}/other-channel?token=${a.stores[1].channelToken}`);
    const untenanted = await suite.kit.rest('GET', `${PROBE}/untenanted`);

    // Assert
    for (const answer of [otherChannel, untenanted]) {
      expect(answer.status).toBe(409);
      expect(answer.body).toMatchObject({ message: NO_ACTIVE_STORE_REFUSAL });
    }
  });
});

describe('CollectionMembershipQueries on a live server (D2317)', () => {
  it('productIdsOf returns rule and manual members of the store only', async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const foreign = await manualWith([await product('Members foreign')]);
    await suite.kit.asOwner(a);
    const tag = await createTag(suite.kit, 'members-rule');
    const matched = await product('Members rule', { tagIds: [tag] });
    const rule = await createCollection(suite.kit, { mode: 'automatic', rule: ruleOf('all', tagIs('is_any_of', tag)) });
    const [first, second] = [await product('Members 1'), await product('Members 2')];
    const manual = await manualWith([second, first]);

    // Act
    const [ruleIds, manualIds, foreignIds] = await Promise.all(
      [rule.id, manual, foreign].map((id) => probe<string[]>(`members?id=${rawId(id)}`)),
    );

    // Assert
    expect(ruleIds).toEqual([matched]);
    expect(manualIds).toEqual([second, first]);
    expect(foreignIds).toEqual([]);
  });

  it("collectionIdsOfProducts answers N products in one call, B's ids absent", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const foreignProduct = await product('Batch foreign');
    await manualWith([foreignProduct]);
    await suite.kit.asOwner(a);
    const [one, two] = [await product('Batch 1'), await product('Batch 2')];
    const first = rawId(await manualWith([one, two]));
    const second = rawId(await manualWith([two]));

    // Act
    const found = await probe<Record<string, string[]>>(
      `of-products?ids=${[one, two, foreignProduct, 'abc'].join(',')}`,
    );
    const isMember = await probe<boolean>(`is-member?id=${second}&product=${one}`);

    // Assert
    expect(found).toEqual({ [one]: [first], [two]: [first, second] });
    expect(isMember).toBe(false);
  });

  it("existingCollectionIds drops B's and deleted ids", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const foreign = rawId(await manualWith([]));
    await suite.kit.asOwner(a);
    const kept = rawId(await manualWith([]));
    const deleted = await manualWith([]);
    await suite.kit.gql(DELETE_COLLECTION, { id: deleted });

    // Act
    const found = await probe<string[]>(`existing?ids=${[foreign, rawId(deleted), kept, '-1'].join(',')}`);

    // Assert
    expect(found).toEqual([kept]);
  });
});
