import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OutboxReconcileSource } from '../../application/outbox-reconcile-source';
import type { OutboxDueScanPort } from '../../application/ports';
import { OUTBOX_DUE_SCAN } from '../../application/tokens';
import { createOutboxTestEnvironment, outboxKit } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1006;
const MINUTE_MS = 60_000;
const BULK_CONSUMER = 'always-failing';
const CRITICAL_CONSUMER = 'counting';

describe('outbox delivery due scan paging', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  const T = new Date();
  let businesses: TwoBusinesses;
  let nextId = 7_400_000_000_000_000_000n;

  const at = (offsetMs: number): Date => new Date(T.getTime() + offsetMs);

  /** An enqueued delivery row whose last activity was at T; `outboxId` lets two consumers share one event. */
  async function seed(consumer: string, outboxId?: string): Promise<{ id: string; jobId: string }> {
    nextId += 1n;
    const id = outboxId ?? nextId.toString();
    await kit.sql(
      `INSERT INTO "outbox_delivery"
         ("businessId", "createdAt", "outboxId", "consumer", "status", "attempts", "enqueuedAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'enqueued', 0, $2, $2)`,
      [businesses.a.businessId, T, id, consumer],
    );
    return { id, jobId: `od-${id}-${consumer}` };
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  beforeEach(async () => {
    await kit.sql(`DELETE FROM "outbox_delivery"`);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('pages past one consumer of an event to its sibling consumer of the same event', async () => {
    // Arrange: both deliveries of one event share createdAt, outboxId and activity time; only the consumer differs.
    const first = await seed(BULK_CONSUMER);
    const sibling = await seed(CRITICAL_CONSUMER, first.id);
    const scan = server.app.get<OutboxDueScanPort>(OUTBOX_DUE_SCAN);
    const since = at(-MINUTE_MS);
    const before = at(MINUTE_MS);

    // Act
    const page1 = await scan.dueDeliveries(since, before, 1);
    const page2 = await scan.dueDeliveries(since, before, 1, page1[0]);
    const page3 = await scan.dueDeliveries(since, before, 1, page2[0]);

    // Assert
    expect([page1[0]?.consumer, page2[0]?.consumer]).toEqual([BULK_CONSUMER, CRITICAL_CONSUMER].sort());
    expect(page2[0]?.outboxId).toBe(sibling.id);
    expect(page3).toEqual([]);
  });

  it('fills a batch with known jobs when rows of a consumer unknown here lead the scan', async () => {
    // Arrange: three rows of a removed consumer sort first, then two known ones.
    await seed('removed-in-a-deploy');
    await seed('removed-in-a-deploy');
    await seed('removed-in-a-deploy');
    const known1 = await seed(BULK_CONSUMER);
    const known2 = await seed(BULK_CONSUMER);
    const source = server.app.get(OutboxReconcileSource);

    // Act
    const page1 = await source.findDue(at(MINUTE_MS), 2);
    const page2 = await source.findDue(at(MINUTE_MS), 2, page1[page1.length - 1]);

    // Assert
    expect(page1.map((job) => job.data.jobId)).toEqual([known1.jobId, known2.jobId]);
    expect(page2).toEqual([]);
  });
});
