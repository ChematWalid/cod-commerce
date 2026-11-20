import type { OutboxDelivery } from '@cod/plugin-platform-outbox';
import { RequestTenantScope } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import type { BusinessFixture } from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import type { QueryRunner } from 'typeorm';
import { CollectionsMembershipConsumer } from '../../infrastructure/membership.consumer';
import { STORE_LOCK_SQL } from '../../infrastructure/pg-collections-lock';
import type { CollectionsKit } from './collections-kit';

const POLL_MS = 50;

/** Polls until `read` returns a value that is not undefined, or fails after `timeoutMs` (outbox kit pattern). */
export async function until<T>(read: () => Promise<T | undefined>, timeoutMs = 20_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error('the condition did not hold in time');
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

/** Polls until `read` answers a value equal (as JSON) to `expected`; answers the last value read. */
export function untilEqual<T>(read: () => Promise<T>, expected: T): Promise<T> {
  const wanted = JSON.stringify(expected);
  return until(async () => {
    const value = await read();
    return JSON.stringify(value) === wanted ? value : undefined;
  });
}

/** One `collections-membership` delivery row of the events about a product. */
export interface MembershipDeliveryRow {
  readonly businessId: string;
  readonly status: string;
}

/** The `collections-membership` deliveries of the `product.changed` events of a product (raw id), oldest first. */
export function membershipDeliveriesOf(kit: CollectionsKit, rawProductId: string): Promise<MembershipDeliveryRow[]> {
  return kit.query<MembershipDeliveryRow>(
    `SELECT d."businessId"::text AS "businessId", d.status FROM outbox_delivery d
       JOIN outbox_event e ON e.id = d."outboxId" AND e."createdAt" = d."createdAt"
     WHERE d.consumer = 'collections-membership' AND e.topic = 'product.changed' AND e."aggregateId" = $1
     ORDER BY d."createdAt", d."outboxId"`,
    [rawProductId],
  );
}

/** Waits until every `collections-membership` delivery about the product is done, at least `count` of them. */
export function settledDeliveriesOf(
  kit: CollectionsKit,
  rawProductId: string,
  count = 1,
): Promise<MembershipDeliveryRow[]> {
  return until(async () => {
    const rows = await membershipDeliveriesOf(kit, rawProductId);
    return rows.length >= count && rows.every((row) => row.status === 'done') ? rows : undefined;
  });
}

let nextOutboxId = 1_600_000_000_000_000_001n;

/**
 * Runs the consumer's handler for a hand-made `product.changed` of `business`'s store in its own committed
 * transaction, the way the delivery runner does: a redelivery or a late, stale event. It bypasses the runner, whose
 * class the outbox plugin does not export; the runner's own skip of a settled delivery is tested in that plugin.
 */
export async function deliverDirectly(
  kit: CollectionsKit,
  business: BusinessFixture,
  payload: { readonly productId: string; readonly change: string },
): Promise<void> {
  const storeId = business.stores[0].id;
  const outboxId = String(nextOutboxId);
  nextOutboxId += 1n;
  const delivery: OutboxDelivery = {
    outboxId,
    createdAt: new Date().toISOString(),
    businessId: business.businessId,
    storeId,
    topic: 'product.changed',
    aggregateId: payload.productId,
    payload: { ...payload, storeId },
    consumer: 'collections-membership',
    idempotencyKey: `${outboxId}:collections-membership`,
    attempt: 1,
  };
  const ctx = await kit.app.get(RequestContextService).create({ apiType: 'admin' });
  await kit.app
    .get(TransactionalConnection)
    .withTransaction(ctx, (txCtx) =>
      kit.app
        .get(CollectionsMembershipConsumer)
        .handle(delivery, new RequestTenantScope(txCtx, toBusinessId(business.businessId))),
    );
}

/** Opens a transaction holding the store lock of `storeId` (D2334); commit and release it to let writers through. */
export async function holdStoreLock(kit: CollectionsKit, storeId: string): Promise<QueryRunner> {
  const runner = kit.app.get(TransactionalConnection).rawConnection.createQueryRunner();
  await runner.connect();
  await runner.startTransaction();
  await runner.query(STORE_LOCK_SQL, [storeId]);
  return runner;
}

/** True when some session waits on an advisory lock: a membership writer queued behind a held store lock. */
export async function someoneWaitsOnAdvisoryLock(kit: CollectionsKit): Promise<boolean> {
  const waiting = await kit.query<{ readonly pid: number }>(
    "SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND wait_event = 'advisory'",
  );
  return waiting.length > 0;
}

/**
 * Waits until the product's `count`-th delivery either waits on a held store lock or, when nothing makes it wait,
 * is done; only then may the test release the lock.
 */
export async function untilDeliveryWaitsOrSettles(
  kit: CollectionsKit,
  rawProductId: string,
  count: number,
): Promise<void> {
  await until(async () => {
    if (await someoneWaitsOnAdvisoryLock(kit)) return true;
    const rows = await membershipDeliveriesOf(kit, rawProductId);
    return rows.length >= count && rows.every((row) => row.status === 'done') ? true : undefined;
  });
}
