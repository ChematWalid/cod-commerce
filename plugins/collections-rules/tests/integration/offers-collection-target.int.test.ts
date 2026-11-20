import {
  asOperationContext,
  type CoreId,
  OfferAdminService,
  type OperationContext,
  PricingService,
  type StoreScope,
} from '@cod/plugin-offers';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { type OfferInput, toBusinessId, toStoreId } from '@cod/shared';
import type { BusinessFixture, StoreFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { OffersCollectionMembershipSource } from '../../infrastructure/offers-collection-membership.source';
import { createCollection, rawId } from './collections-api';
import { collectionsSuite } from './collections-kit';
import { createRuleProduct, createTag, ruleOf, tagIs } from './collections-rules-api';

/** Worker ids 1016-1019 are P2.S3's and all in use; databases are per file, so sharing one is safe (D2330). */
const suite = collectionsSuite(1016, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const LIST_PRICE = 4_900;
const PERCENT_OFF = 10;
const DISCOUNTED = 4_410;
const TAG_NAME = 'offer-promo';

/** A tagged product (inside the rule) and an untagged one, in the client's active store; raw ids. */
interface Arranged {
  readonly collectionId: string;
  readonly inside: { readonly productId: string; readonly variantId: string };
  readonly outside: { readonly productId: string; readonly variantId: string };
}

const productOf = async (title: string, tagIds: string[]) => {
  const product = await createRuleProduct(suite.kit, { title, tagIds, price: LIST_PRICE });
  const [variant] = product.variants;
  if (variant === undefined) throw new Error(`${title} has no variant`);
  return { productId: rawId(product.id), variantId: rawId(variant.id) };
};

/** In `business`'s `store`: an automatic collection "tag is any of [offer-promo]" and two products. */
async function arrangeIn(business: BusinessFixture, store: StoreFixture): Promise<Arranged> {
  await suite.kit.asOwner(business, store);
  const tag = await createTag(suite.kit, TAG_NAME);
  const inside = await productOf(`Inside ${store.id}`, [tag]);
  const outside = await productOf(`Outside ${store.id}`, []);
  const { id } = await createCollection(suite.kit, { mode: 'automatic', rule: ruleOf('all', tagIs('is_any_of', tag)) });
  return { collectionId: rawId(id), inside, outside };
}

const scopeOf = (business: BusinessFixture, store: StoreFixture): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(store.id),
});

async function contextOf(store: StoreFixture): Promise<OperationContext> {
  const ctx = await suite.kit.app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  return asOperationContext(ctx);
}

const discountOn = (collectionId: string): OfferInput => ({
  kind: 'product_discount',
  method: 'automatic',
  title: 'Collection discount',
  config: { valueType: 'percent', value: PERCENT_OFF, appliesTo: 'targets' },
  targets: [{ refType: 'collection', refId: collectionId }],
});

async function activeOfferIn(business: BusinessFixture, store: StoreFixture, collectionId: string): Promise<void> {
  const admin = suite.kit.app.get(OfferAdminService);
  const [ctx, scope] = [await contextOf(store), scopeOf(business, store)];
  const draft = await admin.createDraft(ctx, scope, discountOn(collectionId));
  await admin.setStatus(ctx, scope, draft.id, 'active');
}

async function subtotalOf(business: BusinessFixture, store: StoreFixture, variantId: string): Promise<number> {
  const quote = await suite.kit.app
    .get(PricingService)
    .quoteForScope(await contextOf(store), scopeOf(business, store), {
      channel: 'storefront',
      lines: [{ variantId, quantity: 1 }],
      destination: { provinceCode: '16', stopdesk: false },
    });
  return quote.subtotal;
}

let a: Arranged;
let a2: Arranged;
let b: Arranged;

beforeAll(async () => {
  const { fixtures } = suite;
  a = await arrangeIn(fixtures.a, fixtures.a.stores[0]);
  a2 = await arrangeIn(fixtures.a, fixtures.a.stores[1]);
  b = await arrangeIn(fixtures.b, fixtures.b.stores[0]);
});

describe('offers collection targets through the registered membership source (D2341)', () => {
  it('matches a collection target through the registered membership source', async () => {
    // Arrange
    const { a: business } = suite.fixtures;
    const store = business.stores[0];
    await activeOfferIn(business, store, a.collectionId);

    // Act
    const [inside, outside] = [
      await subtotalOf(business, store, a.inside.variantId),
      await subtotalOf(business, store, a.outside.variantId),
    ];

    // Assert
    expect(inside).toBe(DISCOUNTED);
    expect(outside).toBe(LIST_PRICE);
  });

  it.each([
    {
      where: "A's second store",
      business: 'a',
      store: 1,
      foreign: () => [a.collectionId, b.collectionId],
      own: () => a2,
    },
    { where: 'business B', business: 'b', store: 0, foreign: () => [a.collectionId, a2.collectionId], own: () => b },
  ] as const)(
    'a collection of another store never matches a product of $where',
    async ({ business, store, foreign, own }) => {
      // Arrange
      const owner = suite.fixtures[business];
      const shop = owner.stores[store];
      for (const collectionId of foreign()) await activeOfferIn(owner, shop, collectionId);

      // Act
      const subtotal = await subtotalOf(owner, shop, own().inside.variantId);

      // Assert
      expect(subtotal).toBe(LIST_PRICE);
    },
  );

  it("answers no collection of A for the same product id asked in A's second store or in business B", async () => {
    // Arrange
    const source = suite.kit.app.get(OffersCollectionMembershipSource);
    const { a: businessA, b: businessB } = suite.fixtures;
    const productIds = [a.inside.productId as CoreId];

    // Act
    const [inA, inA2, inB] = [
      await source.collectionsOf(
        await contextOf(businessA.stores[0]),
        scopeOf(businessA, businessA.stores[0]),
        productIds,
      ),
      await source.collectionsOf(
        await contextOf(businessA.stores[1]),
        scopeOf(businessA, businessA.stores[1]),
        productIds,
      ),
      await source.collectionsOf(
        await contextOf(businessB.stores[0]),
        scopeOf(businessB, businessB.stores[0]),
        productIds,
      ),
    ];

    // Assert
    expect(inA.get(a.inside.productId)).toEqual([a.collectionId]);
    expect(inA2.size).toBe(0);
    expect(inB.size).toBe(0);
  });
});
