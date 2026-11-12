import { JobReconciler } from '@cod/plugin-platform-jobs';
import type { QueueName } from '@cod/shared';
import { PLUGIN_TEST_INITIAL_DATA, createTwoBusinesses, type TwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OUTBOX_EXHAUSTED_ERROR } from '../../domain/constants';
import { OutboxReconcileSource } from '../../application/outbox-reconcile-source';
import type { OutboxDueScanPort } from '../../application/ports';
import { OUTBOX_DUE_SCAN } from '../../application/tokens';
import { FakePresence, type PresenceCall } from '../fixtures/fake-presence';
import { createOutboxTestEnvironment, outboxKit } from './outbox-kit';

const SNOWFLAKE_WORKER_ID = 1019;
const MINUTE_MS = 60_000;
const SECOND_MS = 1000;
const BULK_CONSUMER = 'always-failing';
const CRITICAL_CONSUMER = 'counting';

describe('outbox delivery reconciler', () => {
  const { server, adminClient } = createOutboxTestEnvironment(SNOWFLAKE_WORKER_ID);
  const kit = outboxKit(server);
  const T = new Date();
  let businesses: TwoBusinesses;
  let nextId = 7_300_000_000_000_000_000n;
  let calls: PresenceCall[] = [];
  let presence = new FakePresence(calls);
  let reconciler: JobReconciler;

  const at = (offsetMs: number): Date => new Date(T.getTime() + offsetMs);

  /** An open delivery row whose last activity was at T. */
  async function seed(
    consumer: string,
    extra: { status?: string; attempts?: number; nextAttemptAt?: Date | null; business?: 'a' | 'b' } = {},
  ): Promise<{ id: string; jobId: string }> {
    nextId += 1n;
    const id = nextId.toString();
    await kit.sql(
      `INSERT INTO "outbox_delivery"
         ("businessId", "createdAt", "outboxId", "consumer", "status", "attempts", "enqueuedAt", "nextAttemptAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $2, $7, $2)`,
      [
        businesses[extra.business ?? 'a'].businessId,
        T,
        id,
        consumer,
        extra.status ?? 'enqueued',
        extra.attempts ?? 0,
        extra.nextAttemptAt ?? null,
      ],
    );
    return { id, jobId: `od-${id}-${consumer}` };
  }

  const row = async (id: string): Promise<Record<string, unknown>> =>
    (await kit.sql(`SELECT * FROM "outbox_delivery" WHERE "outboxId" = $1`, [id]))[0] ?? {};

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  }, 120_000);

  beforeEach(async () => {
    await kit.sql(`DELETE FROM "outbox_delivery"`);
    calls = [];
    presence = new FakePresence(calls);
    const queues = {
      add: (queue: QueueName, data: { jobId: string }) => {
        calls.push(['add', queue, data.jobId]);
        return Promise.resolve();
      },
    };
    reconciler = new JobReconciler({
      presence,
      queues: queues as never,
      clock: { now: () => Date.now() },
      logger: { error: () => undefined, warn: () => undefined },
    });
    reconciler.registerSource(server.app.get(OutboxReconcileSource));
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('re-adds a bulk delivery whose job is missing after a minute, without waiting for the SLA', async () => {
    // Arrange
    const { id, jobId } = await seed(BULK_CONSUMER);

    // Act
    const result = await reconciler.reconcile(at(MINUTE_MS));

    // Assert
    expect(result).toEqual({ reenqueued: 1, exhausted: 0 });
    expect(calls).toEqual([['add', 'analytics', jobId]]);
    expect((await row(id))['enqueuedAt']).toEqual(at(MINUTE_MS));
    expect((await row(id))['status']).toBe('enqueued');
  });

  it('leaves a row younger than a minute alone', async () => {
    // Arrange
    await seed(BULK_CONSUMER);

    // Act
    const result = await reconciler.reconcile(at(59 * SECOND_MS));

    // Assert
    expect(result).toEqual({ reenqueued: 0, exhausted: 0 });
    expect(calls).toEqual([]);
  });

  it('marks a pending delivery enqueued when it re-adds it', async () => {
    // Arrange
    const { id } = await seed(CRITICAL_CONSUMER, { status: 'pending' });

    // Act
    await reconciler.reconcile(at(2 * MINUTE_MS));

    // Assert
    expect((await row(id))['status']).toBe('enqueued');
  });

  it.each(['failed', 'completed'] as const)('removes a kept %s job, then adds it', async (state) => {
    // Arrange
    const { jobId } = await seed(BULK_CONSUMER);
    presence.states.set(jobId, state);

    // Act
    await reconciler.reconcile(at(2 * MINUTE_MS));

    // Assert
    expect(calls).toEqual([
      ['remove', 'analytics', jobId],
      ['add', 'analytics', jobId],
    ]);
  });

  it('skips a live critical job at four minutes and replaces it just after five', async () => {
    // Arrange
    const { jobId } = await seed(CRITICAL_CONSUMER);
    presence.states.set(jobId, 'live');

    // Act
    const early = await reconciler.reconcile(at(4 * MINUTE_MS));
    const late = await reconciler.reconcile(at(5 * MINUTE_MS + SECOND_MS));

    // Assert
    expect(early).toEqual({ reenqueued: 0, exhausted: 0 });
    expect(late).toEqual({ reenqueued: 1, exhausted: 0 });
    expect(calls).toEqual([
      ['remove', 'order-effects', jobId],
      ['add', 'order-effects', jobId],
    ]);
  });

  it('lets a live bulk job wait thirty minutes', async () => {
    // Arrange
    const { jobId } = await seed(BULK_CONSUMER);
    presence.states.set(jobId, 'live');

    // Act
    const at29 = await reconciler.reconcile(at(29 * MINUTE_MS));
    const at31 = await reconciler.reconcile(at(31 * MINUTE_MS));

    // Assert
    expect(at29.reenqueued).toBe(0);
    expect(at31.reenqueued).toBe(1);
  });

  it('defers a live job whose next attempt is still in the future', async () => {
    // Arrange
    const { jobId } = await seed(CRITICAL_CONSUMER, { nextAttemptAt: at(20 * MINUTE_MS) });
    presence.states.set(jobId, 'live');

    // Act
    const before = await reconciler.reconcile(at(10 * MINUTE_MS));
    const after = await reconciler.reconcile(at(21 * MINUTE_MS));

    // Assert
    expect(before.reenqueued).toBe(0);
    expect(after.reenqueued).toBe(1);
  });

  it('leaves a delayed bulk job in its backoff, even long past the SLA, and replaces it once it is overdue', async () => {
    // Arrange: a capi style retry waiting 70 minutes, longer than the 30 minute bulk SLA.
    const { jobId } = await seed(BULK_CONSUMER);
    presence.states.set(jobId, 'delayed');
    presence.dueAt.set(jobId, at(70 * MINUTE_MS));

    // Act
    const inBackoff = await reconciler.reconcile(at(65 * MINUTE_MS));
    const justDue = await reconciler.reconcile(at(95 * MINUTE_MS));
    const overdue = await reconciler.reconcile(at(101 * MINUTE_MS));

    // Assert
    expect(inBackoff.reenqueued).toBe(0);
    expect(justDue.reenqueued).toBe(0);
    expect(overdue.reenqueued).toBe(1);
    expect(calls).toEqual([
      ['remove', 'analytics', jobId],
      ['add', 'analytics', jobId],
    ]);
  });

  it('ends a row that used every attempt and is past due as failed, without adding it again', async () => {
    // Arrange: 8 attempts is the whole budget of order-effects, and the final BullMQ failure never reached the wrapper.
    const { id } = await seed(CRITICAL_CONSUMER, { attempts: 8 });

    // Act
    const result = await reconciler.reconcile(at(6 * MINUTE_MS));

    // Assert
    expect(result).toEqual({ reenqueued: 0, exhausted: 1 });
    expect(calls).toEqual([]);
    expect((await row(id))['status']).toBe('failed');
    expect((await row(id))['lastError']).toBe(OUTBOX_EXHAUSTED_ERROR);
    expect((await reconciler.reconcile(at(12 * MINUTE_MS))).exhausted).toBe(0);
  });

  it('lets the last attempt run within its SLA', async () => {
    // Arrange
    const { jobId } = await seed(CRITICAL_CONSUMER, { attempts: 8 });
    presence.states.set(jobId, 'live');

    // Act
    const result = await reconciler.reconcile(at(4 * MINUTE_MS));

    // Assert
    expect(result).toEqual({ reenqueued: 0, exhausted: 0 });
  });

  it('never selects a delivery that is over', async () => {
    // Arrange
    await seed(CRITICAL_CONSUMER, { status: 'done' });
    await seed(CRITICAL_CONSUMER, { status: 'failed' });
    await seed(CRITICAL_CONSUMER, { status: 'parked' });

    // Act
    const result = await reconciler.reconcile(at(2 * MINUTE_MS));

    // Assert
    expect(result).toEqual({ reenqueued: 0, exhausted: 0 });
    expect(calls).toEqual([]);
  });

  it('records each outcome under its own business and leaves the other business untouched', async () => {
    // Arrange
    const lostA = await seed(BULK_CONSUMER);
    const lostB = await seed(BULK_CONSUMER, { business: 'b' });
    const spentB = await seed(CRITICAL_CONSUMER, { business: 'b', attempts: 8 });
    const spentA = await seed(CRITICAL_CONSUMER, { attempts: 8, status: 'enqueued' });

    // Act
    const result = await reconciler.reconcile(at(6 * MINUTE_MS));

    // Assert
    expect(result).toEqual({ reenqueued: 2, exhausted: 2 });
    expect((await row(lostA.id))['businessId']).toBe(businesses.a.businessId);
    expect((await row(lostB.id))['businessId']).toBe(businesses.b.businessId);
    expect((await row(lostB.id))['enqueuedAt']).toEqual(at(6 * MINUTE_MS));
    expect((await row(lostA.id))['enqueuedAt']).toEqual(at(6 * MINUTE_MS));
    expect((await row(spentB.id))['status']).toBe('failed');
    expect((await row(spentB.id))['businessId']).toBe(businesses.b.businessId);
    expect((await row(spentA.id))['status']).toBe('failed');
    expect(
      calls
        .filter(([kind]) => kind === 'add')
        .map(([, , jobId]) => jobId)
        .sort(),
    ).toEqual([lostA.jobId, lostB.jobId].sort());
  });

  it('pages the due scan past the row it was given', async () => {
    // Arrange
    const first = await seed(BULK_CONSUMER);
    const second = await seed(BULK_CONSUMER, { business: 'b' });
    const scan = server.app.get<OutboxDueScanPort>(OUTBOX_DUE_SCAN);
    const since = at(-MINUTE_MS);
    const before = at(MINUTE_MS);

    // Act
    const page1 = await scan.dueDeliveries(since, before, 1);
    const page2 = await scan.dueDeliveries(since, before, 1, page1[0]);
    const page3 = await scan.dueDeliveries(since, before, 1, page2[0]);

    // Assert
    expect([page1[0]?.outboxId, page2[0]?.outboxId]).toEqual([first.id, second.id]);
    expect(page2[0]?.businessId).toBe(businesses.b.businessId);
    expect(page3).toEqual([]);
  });

  it('is registered by the plugin with the application reconciler', () => {
    // Arrange: no pooled queue strategy here, so the real presence port cannot run; read the registration instead.
    const application: unknown = server.app.get(JobReconciler);
    const real = application as { sources: readonly unknown[] };

    // Assert
    expect(real.sources).toContain(server.app.get(OutboxReconcileSource));
  });
});
