import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DeliveryRunner } from '../../application/delivery-runner';
import { OutboxRelayService } from '../../application/outbox-relay.service';
import { createOutboxTestEnvironment, outboxKit, until } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1021;

interface DeliveryRow {
  consumer: string;
  status: string;
  attempts: number;
  lastError: string | null;
}

describe('outbox relay and delivery', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  let businesses: TwoBusinesses;

  const deliveries = (outboxId: string): Promise<DeliveryRow[]> =>
    kit.sql(
      'SELECT consumer, status, attempts, "lastError" FROM outbox_delivery WHERE "outboxId" = $1 ORDER BY consumer',
      [outboxId],
    ) as unknown as Promise<DeliveryRow[]>;

  /** Waits until every delivery of the event is terminal and there is at least `count` of them. */
  const settled = (outboxId: string, count: number): Promise<DeliveryRow[]> =>
    until(async () => {
      const rows = await deliveries(outboxId);
      const done = rows.length >= count && rows.every((row) => !['pending', 'enqueued'].includes(row.status));
      return done ? rows : undefined;
    });

  const seen = async (idempotencyKey: string): Promise<number> =>
    Number(
      (
        await kit.sql('SELECT count(*)::int AS n FROM outbox_counting_seen WHERE "idempotencyKey" = $1', [
          idempotencyKey,
        ])
      )[0]?.['n'],
    );

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('relays a committed event to the matching consumer only, and handles it once even if the relay reruns', async () => {
    // Arrange
    const ref = await kit.commitEvent(businesses.a.businessId, { topic: 'platform.demo', payload: { n: 1 } });

    // Act
    const rows = await settled(ref.id, 1);
    const job = {
      jobId: `ob-${ref.id}`,
      outboxId: ref.id,
      createdAt: ref.createdAt,
      businessId: businesses.a.businessId,
    };
    await server.app.get(OutboxRelayService).relay(job);
    await server.app.get(OutboxRelayService).relay(job);

    // Assert
    expect(rows.map((row) => [row.consumer, row.status])).toEqual([['counting', 'done']]);
    expect((await deliveries(ref.id)).map((row) => row.consumer)).toEqual(['counting']);
    const event = await kit.sql('SELECT status, "relayedAt" FROM outbox_event WHERE id = $1', [ref.id]);
    expect(event[0]?.['status']).toBe('relayed');
    expect(event[0]?.['relayedAt']).not.toBeNull();
    expect(await seen(`${ref.id}:counting`)).toBe(1);
  });

  it('skips a delivery that is already done when its job reruns', async () => {
    // Arrange
    const ref = await kit.commitEvent(businesses.a.businessId, { topic: 'platform.demo', payload: { n: 2 } });
    await settled(ref.id, 1);

    // Act
    await server.app.get(DeliveryRunner).run(
      {
        jobId: `od-${ref.id}-counting`,
        outboxId: ref.id,
        createdAt: ref.createdAt,
        businessId: businesses.a.businessId,
        consumer: 'counting',
      },
      { attempts: 1, retries: 7 },
    );

    // Assert
    expect(await seen(`${ref.id}:counting`)).toBe(1);
    expect((await deliveries(ref.id))[0]?.attempts).toBe(1);
  });

  it('retries a handler that throws on attempts 1 and 2 and ends done on attempt 3', async () => {
    // Arrange
    const ref = await kit.commitEvent(businesses.a.businessId, {
      topic: 'platform.demo',
      payload: { failUntilAttempt: 2 },
    });

    // Act
    const rows = await settled(ref.id, 1);

    // Assert
    expect(rows).toMatchObject([{ consumer: 'counting', status: 'done', attempts: 3 }]);
    expect(await seen(`${ref.id}:counting`)).toBe(1);
  });

  it('ends failed on the last attempt with an error that holds no payload', async () => {
    // Arrange
    const ref = await kit.commitEvent(businesses.a.businessId, {
      topic: 'product.changed',
      payload: { note: 'PAYLOAD-MARKER' },
    });

    // Act
    const rows = await settled(ref.id, 1);

    // Assert
    expect(rows).toMatchObject([{ consumer: 'always-failing', status: 'failed', attempts: 3 }]);
    expect(rows[0]?.lastError).toBe('Error (unexpected)');
  });

  it('parks a delivery whose handler asks to', async () => {
    // Arrange
    const ref = await kit.commitEvent(businesses.a.businessId, { topic: 'parcel.status_changed', payload: { n: 1 } });

    // Act
    const rows = await settled(ref.id, 1);

    // Assert
    expect(rows).toMatchObject([{ consumer: 'parking', status: 'parked', attempts: 1 }]);
  });
});
