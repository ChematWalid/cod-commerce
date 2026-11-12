import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OutboxSweeper } from '../../application/outbox-sweeper';
import type { OutboxDueScanPort, OutboxQueuesPort } from '../../application/ports';
import { OUTBOX_DUE_SCAN } from '../../application/tokens';
import type { OutboxRelayJobData } from '../../domain/outbox-event';
import { FakePresence, type PresenceCall } from '../fixtures/fake-presence';
import { createOutboxTestEnvironment, outboxKit, until } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1023;
const SECOND_MS = 1000;
const FIRST_EVENT_ID = '7100000000000000001';
const RELAYED_EVENT_ID = '7100000000000000002';
const SECOND_BUSINESS_EVENT_ID = '7100000000000000003';
const BULK_BASE = 7_200_000_000_000_000_000n;
const BULK_ROWS = 1200;

describe('outbox sweeper', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  const sweeper = (): OutboxSweeper => server.app.get(OutboxSweeper);
  const T = new Date();
  let businesses: TwoBusinesses;

  const insertEvent = (
    id: string,
    status: 'pending' | 'relayed',
    at: Date,
    business: 'a' | 'b' = 'a',
  ): Promise<unknown> =>
    kit.sql(
      `INSERT INTO "outbox_event" ("businessId", "id", "createdAt", "topic", "payload", "status")
       VALUES ($1, $2, $3, 'order.delivered', '{}', $4)`,
      [businesses[business].businessId, id, at, status],
    );

  const relayJobIds = async (): Promise<string[]> =>
    (await kit.jobsOf('outbox-relay')).map((job) => String(job.data['jobId']));

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    await insertEvent(FIRST_EVENT_ID, 'pending', T);
    await insertEvent(RELAYED_EVENT_ID, 'relayed', T);
    await insertEvent(SECOND_BUSINESS_EVENT_ID, 'pending', T, 'b');
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('leaves a pending row alone before it is a minute old', async () => {
    // Act
    const result = await sweeper().sweep(new Date(T.getTime() + 59 * SECOND_MS));

    // Assert
    expect(result).toEqual({ enqueued: 0 });
    expect(await relayJobIds()).not.toContain(`ob-${FIRST_EVENT_ID}`);
  });

  it('queues the relay of a pending row a minute old and never touches a relayed row', async () => {
    // Act
    const result = await sweeper().sweep(new Date(T.getTime() + 61 * SECOND_MS));

    // Assert
    expect(result).toEqual({ enqueued: 2 });
    const ids = await relayJobIds();
    expect(ids).toContain(`ob-${FIRST_EVENT_ID}`);
    expect(ids).toContain(`ob-${SECOND_BUSINESS_EVENT_ID}`);
    expect(ids).not.toContain(`ob-${RELAYED_EVENT_ID}`);
    const relayed = await until(async () => {
      const rows = await kit.sql(`SELECT "status" FROM "outbox_event" WHERE "id" = $1`, [FIRST_EVENT_ID]);
      return rows[0]?.['status'] === 'relayed' ? true : undefined;
    });
    expect(relayed).toBe(true);
  });

  it('relays each business event under its own business', async () => {
    // Act
    const jobs = await kit.jobsOf('outbox-relay');
    const businessOf = (eventId: string): unknown =>
      jobs.find((job) => job.data['jobId'] === `ob-${eventId}`)?.data['businessId'];

    // Assert
    expect(businessOf(FIRST_EVENT_ID)).toBe(businesses.a.businessId);
    expect(businessOf(SECOND_BUSINESS_EVENT_ID)).toBe(businesses.b.businessId);
    const row = await until(async () => {
      const rows = await kit.sql(
        `SELECT "businessId"::text AS "businessId", "status" FROM "outbox_event" WHERE "id" = $1`,
        [SECOND_BUSINESS_EVENT_ID],
      );
      return rows[0]?.['status'] === 'relayed' ? rows[0] : undefined;
    });
    expect(row).toEqual({ businessId: businesses.b.businessId, status: 'relayed' });
  });

  it('queues every one of 1 200 pending rows in one run', async () => {
    // Arrange
    await kit.sql(
      `INSERT INTO "outbox_event" ("businessId", "id", "createdAt", "topic", "payload", "status")
       SELECT $1, $2::bigint + n, $3, 'order.delivered', '{}', 'pending' FROM generate_series(1, $4) AS n`,
      [businesses.a.businessId, BULK_BASE.toString(), T, BULK_ROWS],
    );
    const queued: OutboxRelayJobData[] = [];
    const recording = {
      enqueueRelay: (data: OutboxRelayJobData) => {
        queued.push(data);
        return Promise.resolve();
      },
    } as unknown as OutboxQueuesPort;
    const scan = server.app.get<OutboxDueScanPort>(OUTBOX_DUE_SCAN);
    const counting = new OutboxSweeper(scan, recording, new FakePresence([]), {
      clock: { now: () => Date.now() },
      logger: { error: () => undefined, warn: () => undefined },
    });

    // Act
    const result = await counting.sweep(new Date(T.getTime() + 61 * SECOND_MS));

    // Assert
    const bulk = queued.filter((data) => BigInt(data.outboxId) > BULK_BASE);
    expect(result.enqueued).toBeGreaterThanOrEqual(BULK_ROWS);
    expect(new Set(bulk.map((data) => data.outboxId)).size).toBe(BULK_ROWS);
    expect(bulk[0]?.jobId).toBe(`ob-${bulk[0]?.outboxId ?? ''}`);
    expect(bulk[0]?.businessId).toBe(businesses.a.businessId);
  });

  describe('a relay job BullMQ still keeps', () => {
    const KEPT_EVENT_ID = '7100000000000000004';
    const AFTER_MS = 61 * SECOND_MS;
    const warnings: string[] = [];

    /** A sweeper over the real scan whose queue and presence record what it does, in order. */
    function recordingSweeper(presence: FakePresence, calls: PresenceCall[]): OutboxSweeper {
      const queues = {
        enqueueRelay: (data: OutboxRelayJobData) => {
          calls.push(['add', 'outbox-relay', data.jobId]);
          return Promise.resolve();
        },
      } as unknown as OutboxQueuesPort;
      const scan = server.app.get<OutboxDueScanPort>(OUTBOX_DUE_SCAN);
      return new OutboxSweeper(scan, queues, presence, {
        clock: { now: () => Date.now() },
        logger: { error: () => undefined, warn: (message) => warnings.push(message) },
      });
    }

    it.each(['failed', 'completed'] as const)(
      'removes a %s relay job before it adds the relay again',
      async (state) => {
        // Arrange
        await kit.sql(`DELETE FROM "outbox_event" WHERE "id" = $1`, [KEPT_EVENT_ID]);
        await insertEvent(KEPT_EVENT_ID, 'pending', T);
        const calls: PresenceCall[] = [];
        const presence = new FakePresence(calls);
        presence.states.set(`ob-${KEPT_EVENT_ID}`, state);

        // Act
        await recordingSweeper(presence, calls).sweep(new Date(T.getTime() + AFTER_MS));

        // Assert
        const own = calls.filter(([, , jobId]) => jobId === `ob-${KEPT_EVENT_ID}`);
        expect(own).toEqual([
          ['remove', 'outbox-relay', `ob-${KEPT_EVENT_ID}`],
          ['add', 'outbox-relay', `ob-${KEPT_EVENT_ID}`],
        ]);
      },
    );

    it('leaves a live relay job alone and still adds the relay', async () => {
      // Arrange
      const calls: PresenceCall[] = [];
      const presence = new FakePresence(calls);
      presence.states.set(`ob-${KEPT_EVENT_ID}`, 'live');

      // Act
      await recordingSweeper(presence, calls).sweep(new Date(T.getTime() + AFTER_MS));

      // Assert
      const own = calls.filter(([, , jobId]) => jobId === `ob-${KEPT_EVENT_ID}`);
      expect(own).toEqual([['add', 'outbox-relay', `ob-${KEPT_EVENT_ID}`]]);
    });

    it('warns without the error message and adds the relay when the presence cannot be read', async () => {
      // Arrange
      const calls: PresenceCall[] = [];
      const presence = new FakePresence(calls);
      presence.stateOf = () => Promise.reject(new Error('secret=hunter2'));
      warnings.length = 0;

      // Act
      await recordingSweeper(presence, calls).sweep(new Date(T.getTime() + AFTER_MS));

      // Assert
      expect(calls.some(([action, , jobId]) => action === 'add' && jobId === `ob-${KEPT_EVENT_ID}`)).toBe(true);
      expect(warnings.some((line) => line.includes(KEPT_EVENT_ID))).toBe(true);
      expect(warnings.join(' ')).not.toContain('hunter2');
    });
  });
});
