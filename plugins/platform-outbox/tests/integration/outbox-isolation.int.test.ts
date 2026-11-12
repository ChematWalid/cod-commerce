import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DeliveryRunner } from '../../application/delivery-runner';
import { OutboxRelayService } from '../../application/outbox-relay.service';
import { seenThroughScope } from '../fixtures/counting-consumer.plugin';
import { OutboxDeliveryEntity } from '../../infrastructure/outbox-delivery.entity';
import { OutboxEventEntity } from '../../infrastructure/outbox-event.entity';
import { createOutboxTestEnvironment, outboxKit, until } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1022;
const UNRELAYED_EVENT_ID = '7000000000000000001';

describe('outbox tenant isolation', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  let businesses: TwoBusinesses;
  let aEvent = '';
  let bEvent = '';

  const handled = (outboxId: string): Promise<string[]> =>
    until(() => Promise.resolve(seenThroughScope.get(`${outboxId}:counting`)));

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    aEvent = (await kit.commitEvent(businesses.a.businessId, { topic: 'platform.demo', payload: { who: 'a' } })).id;
    bEvent = (await kit.commitEvent(businesses.b.businessId, { topic: 'platform.demo', payload: { who: 'b' } })).id;
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('gives a consumer a scope that sees its own business events only', async () => {
    // Act
    const seenByA = await handled(aEvent);
    const seenByB = await handled(bEvent);

    // Assert
    expect(seenByA).toEqual([aEvent]);
    expect(seenByB).toEqual([bEvent]);
  });

  it("finds nothing when business B reads A's event through the tenant repository", async () => {
    // Arrange
    const ctx = await kit.newContext();
    const events = server.app.get(TenantRepositoryFactory).for(OutboxEventEntity);

    // Act
    const crossRead = await events.findOne(kit.scopeOf(ctx, businesses.b.businessId), { id: aEvent });
    const ownRead = await events.findOne(kit.scopeOf(ctx, businesses.b.businessId), { id: bEvent });

    // Assert
    expect(crossRead).toBeNull();
    expect(ownRead?.id).toBe(bEvent);
  });

  it("finds nothing when business B reads A's delivery through the tenant repository", async () => {
    // Arrange
    await handled(aEvent);
    const ctx = await kit.newContext();
    const deliveries = server.app.get(TenantRepositoryFactory).for(OutboxDeliveryEntity);

    // Act
    const crossRead = await deliveries.findOne(kit.scopeOf(ctx, businesses.b.businessId), { outboxId: aEvent });
    const ownRead = await deliveries.findOne(kit.scopeOf(ctx, businesses.a.businessId), { outboxId: aEvent });

    // Assert
    expect(crossRead).toBeNull();
    expect(ownRead?.consumer).toBe('counting');
  });

  it("relays nothing when a job names A's event with business B's id", async () => {
    // Arrange: an event of A that no announcement relays
    const createdAt = new Date();
    await kit.sql(
      `INSERT INTO outbox_event ("businessId", "id", "createdAt", "topic", "payload") VALUES ($1, $2, $3, 'platform.demo', '{}')`,
      [businesses.a.businessId, UNRELAYED_EVENT_ID, createdAt],
    );

    // Act
    await server.app.get(OutboxRelayService).relay({
      jobId: `ob-${UNRELAYED_EVENT_ID}`,
      outboxId: UNRELAYED_EVENT_ID,
      createdAt: createdAt.toISOString(),
      businessId: businesses.b.businessId,
    });

    // Assert
    const deliveries = await kit.sql('SELECT 1 FROM outbox_delivery WHERE "outboxId" = $1', [UNRELAYED_EVENT_ID]);
    const event = await kit.sql('SELECT status FROM outbox_event WHERE id = $1', [UNRELAYED_EVENT_ID]);
    expect(deliveries).toEqual([]);
    expect(event[0]?.['status']).toBe('pending');
    expect(seenThroughScope.has(`${UNRELAYED_EVENT_ID}:counting`)).toBe(false);
  });

  it("does not run A's delivery when a job names it with business B's id", async () => {
    // Arrange
    await handled(aEvent);
    const row = (await kit.sql('SELECT "createdAt", attempts FROM outbox_delivery WHERE "outboxId" = $1', [aEvent]))[0];
    const seenBefore = seenThroughScope.get(`${aEvent}:counting`);

    // Act
    const run = server.app.get(DeliveryRunner).run(
      {
        jobId: `od-${aEvent}-counting`,
        outboxId: aEvent,
        createdAt: (row?.['createdAt'] as Date).toISOString(),
        businessId: businesses.b.businessId,
        consumer: 'counting',
      },
      { attempts: 1, retries: 7 },
    );

    // Assert
    await expect(run).rejects.toMatchObject({ code: 'outbox.delivery-missing' });
    const after = (await kit.sql('SELECT status, attempts FROM outbox_delivery WHERE "outboxId" = $1', [aEvent]))[0];
    expect(after).toMatchObject({ status: 'done', attempts: row?.['attempts'] });
    expect(seenThroughScope.get(`${aEvent}:counting`)).toBe(seenBefore);
  });
});
