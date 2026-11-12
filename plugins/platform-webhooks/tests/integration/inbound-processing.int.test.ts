import { type JobPresence, type JobPresencePort, JobReconciler } from '@cod/plugin-platform-jobs';
import type { QueueName } from '@cod/shared';
import { createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InboundProcessor } from '../../application/inbound-processor';
import { InboundReconcileSource } from '../../application/inbound-reconcile-source';
import { processing } from '../fixtures/test-handler.plugin';
import { createWebhooksTestEnvironment, initWithAccounts, until, webhooksKit } from './webhooks-kit';

const SNOWFLAKE_WORKER_ID = 1004;
const MINUTE_MS = 60_000;
const SECOND_MS = 1000;
const MAX_ATTEMPTS = 10;

type Call = readonly [string, QueueName, string];

describe('inbound webhook processing', () => {
  const environment = createWebhooksTestEnvironment(SNOWFLAKE_WORKER_ID);
  const { server, adminClient } = environment;
  const kit = webhooksKit(server);
  const T = new Date();
  let businesses: TwoBusinesses;
  let nextId = 7_400_000_000_000_000_000n;

  const statusOf = async (id: string): Promise<Record<string, unknown>> =>
    (await kit.sql(`SELECT "status", "attempts", "lastError" FROM "inbound_webhook" WHERE "id" = $1`, [id]))[0] ?? {};

  const idOfLatest = async (): Promise<string> =>
    String(
      (
        await kit.sql(`SELECT "id"::text AS "id" FROM "inbound_webhook" ORDER BY "receivedAt" DESC, "id" DESC LIMIT 1`)
      )[0]?.['id'],
    );

  const waitFor = (id: string, status: string): Promise<Record<string, unknown>> =>
    until(async () => {
      const row = await statusOf(id);
      return row['status'] === status ? row : undefined;
    }, 60_000);

  beforeAll(async () => {
    businesses = await initWithAccounts(environment, () => createTwoBusinesses(adminClient));
  }, 120_000);

  beforeEach(async () => {
    processing.reset();
    await kit.sql(`DELETE FROM "inbound_webhook_key"`);
    await kit.sql(`DELETE FROM "inbound_webhook"`);
    await kit.sql(`DELETE FROM "outbox_delivery"`);
    await kit.sql(`DELETE FROM "outbox_event"`);
  });

  afterAll(async () => {
    await server.destroy();
  });

  it("ends processed after the job and writes the handler's outbox event under the business", async () => {
    // Act
    await kit.post('test', 'acme-a', { body: '{"k":1}' });
    const id = await idOfLatest();
    const row = await waitFor(id, 'processed');

    // Assert
    expect(row['attempts']).toBe(1);
    const events = await kit.sql(`SELECT "businessId"::text AS "businessId" FROM "outbox_event"`);
    expect(events).toEqual([{ businessId: businesses.a.businessId }]);
  });

  it('ends ignored when the handler ignores the event', async () => {
    // Act
    await kit.post('test', 'acme-a', { body: '{"k":"ignore-me"}' });
    const id = await idOfLatest();

    // Assert
    await waitFor(id, 'ignored');
    expect(await kit.sql(`SELECT 1 FROM "outbox_event"`)).toHaveLength(0);
  });

  it('retries a throwing handler and processes on the third attempt without a duplicate outbox event', async () => {
    // Arrange
    processing.failuresLeft = 2;

    // Act
    await kit.post('test', 'acme-a', { body: '{"k":"flaky"}' });
    const id = await idOfLatest();
    const row = await waitFor(id, 'processed');

    // Assert
    expect(row['attempts']).toBe(3);
    expect(processing.calls.get(id)).toBe(3);
    expect(await kit.sql(`SELECT 1 FROM "outbox_event"`)).toHaveLength(1);
  });

  it('ends failed on the last attempt, with an error that does not quote the body', async () => {
    // Arrange
    processing.failuresLeft = 1000;

    // Act
    await kit.post('test', 'acme-a', { body: '{"secret":"do-not-leak"}' });
    const id = await idOfLatest();
    const row = await waitFor(id, 'failed');

    // Assert
    expect(row['attempts']).toBe(MAX_ATTEMPTS);
    expect(String(row['lastError']).length).toBeLessThanOrEqual(500);
    expect(String(row['lastError'])).not.toContain('do-not-leak');
  }, 120_000);

  it('does not call process again when the job of a processed row reruns', async () => {
    // Arrange
    await kit.post('test', 'acme-a', { body: '{"k":"rerun"}' });
    const id = await idOfLatest();
    await waitFor(id, 'processed');
    const [row] = await kit.sql(
      `SELECT "receivedAt", "businessId"::text AS "businessId" FROM "inbound_webhook" WHERE "id" = $1`,
      [id],
    );
    const callsBefore = processing.total();

    // Act
    await server.app.get(InboundProcessor).run(
      {
        jobId: `iw-${id}`,
        inboundId: id,
        receivedAt: (row?.['receivedAt'] as Date).toISOString(),
        businessId: String(row?.['businessId']),
      },
      { attempts: 1, retries: MAX_ATTEMPTS - 1 },
    );

    // Assert
    expect(processing.total()).toBe(callsBefore);
  });

  describe('reconciler source', () => {
    class FakePresence implements JobPresencePort {
      readonly states = new Map<string, JobPresence>();
      stateOf = (_queue: QueueName, jobId: string): Promise<JobPresence> =>
        Promise.resolve(this.states.get(jobId) ?? 'missing');
      remove = (): Promise<void> => Promise.resolve();
    }

    let presence: FakePresence;
    let calls: Call[];
    let reconciler: JobReconciler;
    const at = (offsetMs: number): Date => new Date(T.getTime() + offsetMs);

    async function seedReceived(): Promise<string> {
      nextId += 1n;
      const id = nextId.toString();
      await kit.sql(
        `INSERT INTO "inbound_webhook"
           ("businessId", "id", "receivedAt", "provider", "accountId", "eventKey", "contentType", "headers", "payload", "status", "attempts", "updatedAt")
         VALUES ($1, $2, $3, 'test', 'acct-a', $4, 'application/json', '{}', '\\x7b7d', 'received', 0, $3)`,
        [businesses.a.businessId, id, T, `seed-${id}`],
      );
      return id;
    }

    beforeEach(() => {
      presence = new FakePresence();
      calls = [];
      reconciler = new JobReconciler({
        presence,
        queues: {
          add: (queue: QueueName, data: { jobId: string }) => {
            calls.push(['add', queue, data.jobId]);
            return Promise.resolve();
          },
        } as never,
        clock: { now: () => Date.now() },
        logger: { error: () => undefined, warn: () => undefined },
      });
      reconciler.registerSource(server.app.get(InboundReconcileSource));
    });

    it('re-adds iw-{id} for a received row whose job is missing', async () => {
      // Arrange
      const id = await seedReceived();

      // Act
      const result = await reconciler.reconcile(at(MINUTE_MS));

      // Assert
      expect(result).toEqual({ reenqueued: 1, exhausted: 0 });
      expect(calls).toEqual([['add', 'inbound-webhooks', `iw-${id}`]]);
    });

    it('re-adds a row with a live job only after five minutes', async () => {
      // Arrange
      const id = await seedReceived();
      presence.states.set(`iw-${id}`, 'live');

      // Act
      const early = await reconciler.reconcile(at(5 * MINUTE_MS - SECOND_MS));
      const late = await reconciler.reconcile(at(5 * MINUTE_MS + SECOND_MS));

      // Assert
      expect(early.reenqueued).toBe(0);
      expect(late.reenqueued).toBe(1);
      expect(calls).toEqual([['add', 'inbound-webhooks', `iw-${id}`]]);
    });
  });
});
