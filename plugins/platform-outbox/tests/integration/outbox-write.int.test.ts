import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OutboxService } from '../../application/outbox.service';
import { OutboxEventEntity } from '../../infrastructure/outbox-event.entity';
import { createOutboxTestEnvironment, outboxKit } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1020;
const SETTLE_MS = 300;

describe('OutboxService.add', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  let businesses: TwoBusinesses;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('refuses a write outside a transaction', async () => {
    // Arrange
    const scope = kit.scopeOf(await kit.newContext(), businesses.a.businessId);

    // Act
    const add = server.app.get(OutboxService).add(scope, { topic: 'platform.demo', payload: { n: 1 } });

    // Assert
    await expect(add).rejects.toMatchObject({ code: 'outbox.transaction-required' });
  });

  it('leaves no row and enqueues no relay job when the transaction rolls back', async () => {
    // Arrange
    const ctx = await kit.newContext();
    let written = '';

    // Act
    const failing = kit.connection().withTransaction(ctx, async (txCtx) => {
      const ref = await server.app
        .get(OutboxService)
        .add(kit.scopeOf(txCtx, businesses.a.businessId), { topic: 'platform.demo', payload: { n: 2 } });
      written = ref.id;
      throw new Error('the work after the write failed');
    });
    await expect(failing).rejects.toThrow('the work after the write failed');
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    // Assert
    expect(written).not.toBe('');
    expect(await kit.sql('SELECT 1 FROM outbox_event WHERE id = $1', [written])).toHaveLength(0);
    const relayJobs = await kit.jobsOf('outbox-relay');
    expect(relayJobs.some((job) => job.data['outboxId'] === written)).toBe(false);
  });

  it('writes a pending row under the scope business, whatever the payload holds', async () => {
    // Arrange
    const ctx = await kit.newContext();
    let statusInside: unknown;
    let ref: { id: string; createdAt: string } | undefined;

    // Act
    await kit.connection().withTransaction(ctx, async (txCtx) => {
      ref = await server.app.get(OutboxService).add(kit.scopeOf(txCtx, businesses.a.businessId), {
        topic: 'platform.demo',
        payload: { businessId: businesses.b.businessId, n: 3 },
        aggregateId: '4711',
        storeId: businesses.a.stores[0].id,
        dedupeKey: 'demo-3',
      });
      const inside: { status: string }[] = await kit
        .connection()
        .getRepository(txCtx, OutboxEventEntity)
        .query('SELECT status FROM outbox_event WHERE id = $1', [ref.id]);
      statusInside = inside[0]?.status;
    });

    // Assert
    expect(statusInside).toBe('pending');
    const rows = await kit.sql(
      'SELECT "businessId", "storeId", "aggregateId", "dedupeKey", topic FROM outbox_event WHERE id = $1',
      [ref?.id],
    );
    expect(rows).toEqual([
      {
        businessId: businesses.a.businessId,
        storeId: businesses.a.stores[0].id,
        aggregateId: '4711',
        dedupeKey: 'demo-3',
        topic: 'platform.demo',
      },
    ]);
  });

  it('rejects a payload that names a credential or exceeds the cap, and writes nothing', async () => {
    // Arrange
    const before = await kit.sql('SELECT count(*)::int AS n FROM outbox_event');

    // Act
    const credential = kit.commitEvent(businesses.a.businessId, { topic: 'platform.demo', payload: { apiKey: 'x' } });
    const oversized = kit.commitEvent(businesses.a.businessId, {
      topic: 'platform.demo',
      payload: { note: 'x'.repeat(4097) },
    });

    // Assert
    await expect(credential).rejects.toMatchObject({ code: 'outbox.payload-rejected' });
    await expect(oversized).rejects.toMatchObject({ code: 'outbox.payload-rejected' });
    expect(await kit.sql('SELECT count(*)::int AS n FROM outbox_event')).toEqual(before);
  });
});
