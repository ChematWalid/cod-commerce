import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { toBusinessId, toStoreId } from '@cod/shared';
import type { BusinessFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ReconcileSweepService } from '../../application/reconcile-sweep.service';
import { STORE_RECONCILE_QUEUE } from '../../application/tokens';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreReconcileQueuePort } from '../../domain/ports/store-reconcile.port';
import { MatchVersionCheck } from '../../infrastructure/reconcile.task';
import { createCollection, rawId } from './collections-api';
import { deliverDirectly, settledDeliveriesOf, untilEqual } from './collections-deliveries';
import { collectionsSuite } from './collections-kit';
import { createRuleProduct, createTag, ruleOf, tagIs } from './collections-rules-api';

const suite = collectionsSuite(1017, { plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });

const MEMBERS_SQL = 'SELECT "productId"::text AS "productId" FROM collections_member WHERE "collectionId" = $1';
const DROP_MEMBERS = 'DELETE FROM collections_member WHERE "collectionId" = $1';
const AGE_MATCH_VERSION = 'UPDATE collections_definition SET "matchVersion" = 0 WHERE "collectionId" = $1';

/** An automatic collection of `business` matching its tag `promo`, holding one product once delivered. */
interface MatchedCollection {
  readonly collectionId: string;
  readonly productId: string;
}

let ofA: MatchedCollection;
let ofB: MatchedCollection;

/** Raw product ids of a collection's member rows, read past the API (no tenant scope). */
async function memberRowsOf(collectionId: string): Promise<string[]> {
  const rows = await suite.kit.query<{ readonly productId: string }>(MEMBERS_SQL, [rawId(collectionId)]);
  return rows.map((row) => row.productId);
}

async function matchedCollectionOf(business: BusinessFixture, title: string): Promise<MatchedCollection> {
  await suite.kit.asOwner(business);
  const tag = await createTag(suite.kit, 'promo');
  const { id: collectionId } = await createCollection(suite.kit, {
    mode: 'automatic',
    rule: ruleOf('all', tagIs('is_any_of', tag)),
  });
  const { id: productId } = await createRuleProduct(suite.kit, { title, tagIds: [tag] });
  await settledDeliveriesOf(suite.kit, rawId(productId));
  await untilEqual(async () => (await memberRowsOf(collectionId)).includes(rawId(productId)), true);
  return { collectionId, productId };
}

const scopeOf = (business: BusinessFixture) => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(business.stores[0].id),
});

const healed = (matched: MatchedCollection): Promise<boolean> =>
  untilEqual(async () => (await memberRowsOf(matched.collectionId)).includes(rawId(matched.productId)), true);

beforeAll(async () => {
  ofA = await matchedCollectionOf(suite.fixtures.a, 'A promo');
  ofB = await matchedCollectionOf(suite.fixtures.b, 'B promo');
});

describe('cross-tenant guards of the membership writers (D2313, CLAUDE.md 3a.10)', () => {
  it("a delivery of A with no row store naming B's store in its payload writes nothing in B", async () => {
    // Arrange
    await suite.kit.query(DROP_MEMBERS, [rawId(ofB.collectionId)]);
    const payload = { productId: rawId(ofB.productId), change: 'updated' };

    // Act
    await deliverDirectly(suite.kit, suite.fixtures.a, payload, {
      rowStoreId: null,
      payloadStoreId: suite.fixtures.b.stores[0].id,
    });

    // Assert
    expect(await memberRowsOf(ofB.collectionId)).toEqual([]);

    // Positive control: the same delivery under B's own business repairs B.
    await deliverDirectly(suite.kit, suite.fixtures.b, payload, { rowStoreId: null });
    expect(await memberRowsOf(ofB.collectionId)).toEqual([rawId(ofB.productId)]);
  });

  it("a reconcile job naming A's business with B's store rebuilds nothing in B", async () => {
    // Arrange
    const queue = suite.kit.app.get<StoreReconcileQueuePort>(STORE_RECONCILE_QUEUE);
    await suite.kit.query(DROP_MEMBERS, [rawId(ofB.collectionId)]);
    await suite.kit.query(DROP_MEMBERS, [rawId(ofA.collectionId)]);

    // Act: the reconcile queue runs one job at a time in order, so A's own repair settles after the foreign job.
    await queue.enqueue(
      { businessId: toBusinessId(suite.fixtures.a.businessId), storeId: scopeOf(suite.fixtures.b).storeId },
      'save',
    );
    await queue.enqueue(scopeOf(suite.fixtures.a), 'save');
    expect(await healed(ofA)).toBe(true);

    // Assert
    expect(await memberRowsOf(ofB.collectionId)).toEqual([]);

    // Positive control: B's own business repairs it.
    await queue.enqueue(scopeOf(suite.fixtures.b), 'save');
    expect(await healed(ofB)).toBe(true);
  });
});

describe('the platform sweeps across businesses (D2336)', () => {
  it('the bootstrap check and the nightly sweep queue each store for its own business and heal it', async () => {
    // Arrange
    await suite.kit.query(DROP_MEMBERS, [rawId(ofA.collectionId)]);
    await suite.kit.query(AGE_MATCH_VERSION, [rawId(ofA.collectionId)]);
    const queue = suite.kit.app.get<StoreReconcileQueuePort>(STORE_RECONCILE_QUEUE);
    const enqueued = vi.spyOn(queue, 'enqueue');
    const ownerOf = new Map(
      [suite.fixtures.a, suite.fixtures.b].flatMap((business) =>
        business.stores.map((store) => [store.id, business.businessId] as const),
      ),
    );

    // Act
    const stale = await suite.kit.app.get(MatchVersionCheck).check();
    const repaired = await healed(ofA);
    const ctx = await suite.kit.app.get(RequestContextService).create({ apiType: 'admin' });
    const nightly = await suite.kit.app.get(ReconcileSweepService).enqueueAll(asOperationContext(ctx));
    const calls = enqueued.mock.calls.map(([scope, reason]) => ({ ...scope, reason }));
    enqueued.mockRestore();

    // Assert
    expect(stale).toBeGreaterThanOrEqual(1);
    expect(repaired).toBe(true);
    expect(nightly).toBeGreaterThanOrEqual(2);
    expect(calls).toContainEqual({ ...scopeOf(suite.fixtures.a), reason: 'version' });
    expect(calls).toContainEqual({ ...scopeOf(suite.fixtures.b), reason: 'nightly' });
    for (const call of calls) expect(call.businessId).toBe(ownerOf.get(call.storeId));
  });
});
