import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { toBusinessId, toStoreId } from '@cod/shared';
import { beforeAll, describe, expect, it } from 'vitest';
import { SaveRecomputeService } from '../../application/save-recompute.service';
import { STORE_RECONCILE_QUEUE } from '../../application/tokens';
import type { StoreReconcileQueuePort } from '../../domain/ports/store-reconcile.port';
import { createCollection, rawId } from './collections-api';
import {
  deliverDirectly,
  holdStoreLock,
  membershipDeliveriesOf,
  settledDeliveriesOf,
  untilEqual,
  untilDeliveryWaitsOrSettles,
} from './collections-deliveries';
import { collectionsSuite } from './collections-kit';
import { createProduct, productIdsOf } from './collections-products';
import { createRuleProduct, createTag, priceBetween, ruleOf, tagIs, updateRuleProduct } from './collections-rules-api';

const suite = collectionsSuite(1017, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const DELETE_TAG = 'mutation ($id: String!) { deleteCatalogTag(id: $id) }';
const DELETE_PRODUCT = 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }';
const SET_PRODUCTS =
  'mutation ($id: ID!, $productIds: [ID!]!) { setStoreCollectionProducts(id: $id, productIds: $productIds) { id } }';
const COPY_RULE =
  'UPDATE collections_definition SET rule = (SELECT rule FROM collections_definition WHERE "collectionId" = $1) WHERE "collectionId" = $2';
const DROP_MEMBER = 'DELETE FROM collections_member WHERE "collectionId" = $1 AND "productId" = $2';

let promoTag: string;
let plainTag: string;

const membersOf = (collectionId: string): Promise<string[]> => productIdsOf(suite.kit, collectionId);
const settle = async (productId: string, count = 1): Promise<void> => {
  await settledDeliveriesOf(suite.kit, rawId(productId), count);
};

/** A product of A tagged `tagIds` at `price`, once its creation's delivery is done. */
async function productOfA(title: string, tagIds: string[], price = 2_000): Promise<string> {
  const { id } = await createRuleProduct(suite.kit, { title, tagIds, price });
  await settle(id);
  return id;
}

describe('membership follows product changes (D2312, AC5)', () => {
  beforeAll(async () => {
    await suite.kit.asOwner(suite.fixtures.a);
    promoTag = await createTag(suite.kit, 'promo');
    plainTag = await createTag(suite.kit, 'plain');
  });

  it("adding tag promo to a product adds it to 'Tag is any of [promo]', raising its price above the range removes it", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const rule = ruleOf('all', tagIs('is_any_of', promoTag), priceBetween(1_000, 5_000));
    const { id } = await createCollection(suite.kit, { mode: 'automatic', rule });
    const product = await productOfA('Sandal', [plainTag]);

    // Act
    await updateRuleProduct(suite.kit, product, { tagIds: [promoTag] });
    const afterTag = await untilEqual(() => membersOf(id), [product]);
    await updateRuleProduct(suite.kit, product, { price: 9_000 });
    const afterPrice = await untilEqual(() => membersOf(id), []);

    // Assert
    expect(afterTag).toEqual([product]);
    expect(afterPrice).toEqual([]);
  });

  it('a tag delete recomputes the collections that name it', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const doomed = await createTag(suite.kit, 'doomed');
    const product = await productOfA('Doomed boot', [doomed]);
    const named = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', doomed)),
    });
    const without = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_not', doomed)),
    });
    expect(await membersOf(named.id)).toEqual([product]);
    expect(await membersOf(without.id)).not.toContain(product);

    // Act
    await suite.kit.gql(DELETE_TAG, { id: doomed });
    const left = await untilEqual(() => membersOf(named.id), []);
    const joined = await untilEqual(async () => (await membersOf(without.id)).includes(product), true);

    // Assert
    expect(left).toEqual([]);
    expect(joined).toBe(true);
  });

  it('deleting a product removes it from a manual collection', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await createProduct(suite.kit, 'Short-lived');
    const { id } = await createCollection(suite.kit);
    await suite.kit.gql(SET_PRODUCTS, { id, productIds: [product] });

    // Act
    await suite.kit.gql(DELETE_PRODUCT, { id: product });
    await settle(product, 2);

    // Assert
    expect(await membersOf(id)).toEqual([]);
  });
});

describe('late, repeated and concurrent work ends with the latest facts (Review Focus 4, D2334)', () => {
  it('a redelivered or stale event ends with membership built from the latest facts', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', promoTag)),
    });
    const kept = await productOfA('Kept', [promoTag]);
    const gone = await productOfA('Gone', [promoTag]);
    await suite.kit.gql(DELETE_PRODUCT, { id: gone });
    await settle(gone, 2);
    const before = await membersOf(id);
    await suite.kit.query(DROP_MEMBER, [rawId(id), rawId(kept)]);

    // Act
    for (const change of ['created', 'updated']) {
      await deliverDirectly(suite.kit, suite.fixtures.a, { productId: rawId(kept), change });
    }
    await deliverDirectly(suite.kit, suite.fixtures.a, { productId: rawId(gone), change: 'updated' });

    // Assert
    const after = await membersOf(id);
    expect(after).toEqual(before);
    expect(after).toContain(kept);
    expect(after).not.toContain(gone);
  });

  it('concurrent deliveries of one product converge to its latest facts', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', promoTag)),
    });
    const product = await productOfA('Twice', [plainTag]);
    await updateRuleProduct(suite.kit, product, { tagIds: [promoTag] });
    await settle(product, 2);
    await suite.kit.query(DROP_MEMBER, [rawId(id), rawId(product)]);

    // Act
    await Promise.all(
      [1, 2, 3].map(() =>
        deliverDirectly(suite.kit, suite.fixtures.a, { productId: rawId(product), change: 'updated' }),
      ),
    );

    // Assert
    expect(await membersOf(id)).toContain(product);
  });

  it('a product edit during a rule save ends with the correct membership', async () => {
    // Arrange: the collection matches plain and holds the plain product; a second one stores the promo rule.
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', plainTag)),
    });
    const promoRuled = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', promoTag)),
    });
    const product = await productOfA('Raced', [plainTag]);
    expect(await membersOf(id)).toContain(product);

    // Act: a save holding the store lock switches the rule to promo; the product edit to promo commits meanwhile,
    // so its delivery must wait on the lock and read the saved rule, not the old one.
    const storeId = suite.fixtures.a.stores[0].id;
    const save = await holdStoreLock(suite.kit, storeId);
    try {
      await save.query(COPY_RULE, [rawId(promoRuled.id), rawId(id)]);
      await updateRuleProduct(suite.kit, product, { tagIds: [promoTag] });
      await untilDeliveryWaitsOrSettles(suite.kit, storeId, rawId(product), 2);
      await save.commitTransaction();
    } finally {
      if (save.isTransactionActive) await save.rollbackTransaction();
      await save.release();
    }
    await settle(product, 2);

    // Assert
    expect(await membersOf(id)).toContain(product);
  });
});

describe('the store reconcile (D2336)', () => {
  it('repairs a membership changed behind its back', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const product = await productOfA('Healed', [promoTag]);
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', promoTag)),
    });
    await suite.kit.query('DELETE FROM collections_member WHERE "collectionId" = $1', [rawId(id)]);
    const store = suite.fixtures.a;
    const queue = suite.kit.app.get<StoreReconcileQueuePort>(STORE_RECONCILE_QUEUE);

    // Act
    await queue.enqueue(
      { businessId: toBusinessId(store.businessId), storeId: toStoreId(store.stores[0].id) },
      'nightly',
    );
    const healed = await untilEqual(async () => (await membersOf(id)).includes(product), true);

    // Assert
    expect(healed).toBe(true);
  });

  it('a save over the sync cap answers at once and the job fills membership', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const products = [await productOfA('Large 1', [promoTag]), await productOfA('Large 2', [promoTag])];
    const saves = suite.kit.app.get(SaveRecomputeService);
    const syncMax: unknown = Reflect.get(saves, 'syncMax');
    Reflect.set(saves, 'syncMax', 1);

    // Act
    const created = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_any_of', promoTag)),
    }).finally(() => Reflect.set(saves, 'syncMax', syncMax));
    const filled = await untilEqual(async () => (await membersOf(created.id)).length >= 2, true);

    // Assert
    expect(created.productCount).toBe(0);
    expect(filled).toBe(true);
    expect(await membersOf(created.id)).toEqual(expect.arrayContaining(products));
  });
});

describe('tenant isolation of the consumer (D2313)', () => {
  it("B's product change never writes A's rows and its delivery carries B's business", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const { id } = await createCollection(suite.kit, {
      mode: 'automatic',
      rule: ruleOf('all', tagIs('is_not', promoTag)),
    });
    const before = await membersOf(id);
    await suite.kit.asOwner(suite.fixtures.b);
    const tagOfB = await createTag(suite.kit, 'promo');
    const { id: productOfB } = await createRuleProduct(suite.kit, { title: 'B shoe', tagIds: [tagOfB] });

    // Act
    const deliveries = await settledDeliveriesOf(suite.kit, rawId(productOfB));
    await suite.kit.asOwner(suite.fixtures.a);

    // Assert
    expect(deliveries.map((row) => row.businessId)).toEqual([suite.fixtures.b.businessId]);
    expect(await membersOf(id)).toEqual(before);
    const rowsOfB = await suite.kit.query('SELECT 1 FROM collections_member WHERE "productId" = $1', [
      rawId(productOfB),
    ]);
    expect(rowsOfB).toEqual([]);
    expect(await membershipDeliveriesOf(suite.kit, rawId(productOfB))).toHaveLength(1);
  });
});
