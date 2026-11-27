import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { describe, expect, it } from 'vitest';
import { CollectionsReadProbePlugin } from '../fixtures/public-read-probe.plugin';
import { createCollection, rawId } from './collections-api';
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

const membersOf = (collectionId: string) => probe<string[] | null>(`visible-members?id=${rawId(collectionId)}`);
const bySlug = async (slug: string) =>
  (await probe<{ id: string | null }>(`by-slug?slug=${encodeURIComponent(slug)}`)).id;

const product = async (title: string, input: Readonly<Record<string, unknown>> = {}): Promise<string> =>
  rawId((await createRuleProduct(suite.kit, { title, ...input })).id);

async function manualWith(productIds: readonly string[], overrides: Record<string, unknown> = {}): Promise<string> {
  const { id } = await createCollection(suite.kit, overrides);
  if (productIds.length > 0) {
    await suite.kit.gql(SET_COLLECTION_PRODUCTS, { id, productIds: productIds.map((productId) => `T_${productId}`) });
  }
  return id;
}

describe('CollectionsReadService.visibleMemberIds on a live server (P3.S2, D3206)', () => {
  it('names every member of a visible collection, hidden and draft products included, in hand order', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const active = await product('Lookup active');
    const draft = await product('Lookup draft', { status: 'draft' });
    const soldOut = await product('Lookup sold out');
    await suite.kit.gql(UPDATE_PRODUCT, { id: `T_${soldOut}`, input: { settings: { soldOut: true } } });
    const collectionId = await manualWith([soldOut, active, draft]);

    // Act
    const ids = await membersOf(collectionId);

    // Assert
    expect(ids).toEqual([soldOut, active, draft]);
  });

  it('names the members an automatic collection matched', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const tag = await createTag(suite.kit, 'lookup-rule');
    const matched = await product('Lookup matched', { tagIds: [tag] });
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', tag)),
    });

    // Act / Assert
    expect(await membersOf(id)).toEqual([matched]);
  });

  it("a hidden collection, B's, A's other store's and malformed ids answer null", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const foreign = await manualWith([await product('Lookup foreign')]);
    await suite.kit.asOwner(a, a.stores[1]);
    const otherStore = await manualWith([await product('Lookup other store')]);
    await suite.kit.asOwner(a);
    const hidden = await manualWith([await product('Lookup hidden')], { visible: false });

    // Act
    const answers = await Promise.all([foreign, otherStore, hidden, 'abc', '-1', '1.5'].map(membersOf));

    // Assert
    expect(answers).toEqual([null, null, null, null, null, null]);
  });
});

describe('CollectionsReadService.findVisibleBySlug on a live server (P3.S2 /category/[slug])', () => {
  it("finds A's own collection when B uses the same slug, and never B's", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    const foreign = await manualWith([], { slug: 'lookup-twin' });
    await suite.kit.asOwner(a);
    const own = await manualWith([], { slug: 'lookup-twin' });

    // Act
    const found = await bySlug('lookup-twin');

    // Assert
    expect(found).toBe(rawId(own));
    expect(found).not.toBe(rawId(foreign));
  });

  it("a hidden collection's, B's only, A's other store's, an unknown or a blank slug answers null", async () => {
    // Arrange
    const { a, b } = suite.fixtures;
    await suite.kit.asOwner(b);
    await manualWith([], { slug: 'lookup-b-only' });
    await suite.kit.asOwner(a, a.stores[1]);
    await manualWith([], { slug: 'lookup-other-store' });
    await suite.kit.asOwner(a);
    await manualWith([], { slug: 'lookup-hidden', visible: false });

    // Act
    const answers = await Promise.all(
      ['lookup-hidden', 'lookup-b-only', 'lookup-other-store', 'lookup-none', ' ', 'x'.repeat(600)].map(bySlug),
    );

    // Assert
    expect(answers).toEqual([null, null, null, null, null, null]);
  });
});
