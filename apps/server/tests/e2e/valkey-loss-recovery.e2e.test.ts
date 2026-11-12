import { JobReconciler, PlatformQueues, PooledJobQueueStrategy } from '@cod/plugin-platform-jobs';
import { OutboxService, OutboxSweeper } from '@cod/plugin-platform-outbox';
import { bullMqJobOptions } from '@cod/plugin-platform-jobs';
import { RequestTenantScope } from '@cod/plugin-tenancy';
import { type QueuePool, toBusinessId } from '@cod/shared';
import { ConfigService, RequestContextService, TransactionalConnection } from '@vendure/core';
import { createTestEnvironment, E2E_DEFAULT_CHANNEL_TOKEN } from '@vendure/testing';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bullMqOptions } from '../../src/config/redis.config';
import {
  BULK_EFFECT_CONSUMER,
  BULK_EFFECT_TOPIC,
  CRITICAL_EFFECT_CONSUMER,
  CRITICAL_EFFECT_TOPIC,
  EFFECT_EVENT_HEADER,
  EFFECT_PROVIDER,
  EFFECT_SIGNATURE_HEADER,
  EFFECT_TABLE_DDL,
  EffectCounterPlugin,
  effectAccounts,
  effectSignature,
} from './fixtures/effect-counter.plugin';
import {
  afterE2eInit,
  buildE2eConfig,
  E2E_INITIAL_DATA,
  e2eEnv,
  e2eRedis,
  useE2ePlatformJobs,
} from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

import {
  LONG_BACKOFF_MS,
  MINUTE_MS,
  PROVISION_BUSINESS,
  SHORT_BACKOFF_MS,
  testRedisUrl,
  until,
  UPDATE_GLOBAL_LANGUAGES,
  VALKEY_TEST_DATABASE,
} from './support/valkey-loss';

const SUITE = 'valkey-loss-recovery';
const ACCOUNT_KEY = 'e2e-effects';

const BULK_EVENTS = 6;
const DELAYED_EVENTS = 6;
const RETRYING_EVENTS = 3;
const PENDING_EVENTS = 8;
const WEBHOOKS = 10;

describe('recovery after the loss of Valkey', () => {
  const env = { REDIS_URL: testRedisUrl(), PLATFORM_DEMO_HANDLERS: 'true', WORKER_POOL: 'all' };
  const { server, adminClient } = createTestEnvironment(
    buildE2eConfig({ plugins: [EffectCounterPlugin] }, { suite: SUITE, port: E2E_PORTS.valkeyLoss, env }),
  );
  const appEnv = e2eEnv({ env });
  const redis = e2eRedis(appEnv);
  let backoffMs = LONG_BACKOFF_MS;
  let businessId = '';

  const connection = (): TransactionalConnection => server.app.get(TransactionalConnection);
  const sql = (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    connection().rawConnection.query(statement, parameters);
  const bullQueue = (pool: QueuePool): Queue =>
    (server.app.get(ConfigService).jobQueueOptions.jobQueueStrategy as PooledJobQueueStrategy).bullQueueOf(pool);
  const later = (): Date => new Date(Date.now() + MINUTE_MS);

  async function commitEventRef(
    topic: string,
    payload: Record<string, string | number | boolean>,
  ): Promise<{ id: string; createdAt: string }> {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    const scope = (txCtx: typeof ctx): RequestTenantScope => new RequestTenantScope(txCtx, toBusinessId(businessId));
    return connection().withTransaction(ctx, (txCtx) =>
      server.app.get(OutboxService).add(scope(txCtx), { topic: topic as 'order.placed', payload }),
    );
  }

  const commitEvent = async (topic: string, payload: Record<string, string | number | boolean>): Promise<string> =>
    (await commitEventRef(topic, payload)).id;

  async function postWebhook(n: number): Promise<void> {
    const body = JSON.stringify({ n });
    const { port } = (
      server.app.getHttpServer() as import('node:http').Server
    ).address() as import('node:net').AddressInfo;
    const response = await fetch(`http://localhost:${String(port)}/webhooks/${EFFECT_PROVIDER}/${ACCOUNT_KEY}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [EFFECT_SIGNATURE_HEADER]: effectSignature(body),
        [EFFECT_EVENT_HEADER]: `evt-${String(n)}`,
      },
      body,
    });
    expect(response.status).toBe(200);
  }

  const deliveryRows = (): Promise<Record<string, unknown>[]> =>
    sql(`SELECT "outboxId"::text AS "outboxId", "consumer", "status", "attempts" FROM "outbox_delivery"`);

  const countWhere = async (table: string, where: string): Promise<number> =>
    Number((await sql(`SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`))[0]?.['n']);

  const jobCount = async (pool: QueuePool): Promise<number> => {
    const counts = await bullQueue(pool).getJobCounts('waiting', 'paused', 'prioritized');
    return Object.values(counts).reduce((sum, n) => sum + n, 0);
  };

  beforeAll(async () => {
    expect(redis.options.db).toBe(VALKEY_TEST_DATABASE);
    // Start from an empty database of our own: keys a previous run left behind must not change the counts.
    if (redis.options.db === VALKEY_TEST_DATABASE) await redis.flushdb();
    const registryOptions = bullMqJobOptions();
    // The registry's options with a backoff the test controls, so retries either finish at once or never come.
    useE2ePlatformJobs(SUITE, appEnv, {
      ...bullMqOptions(appEnv),
      setJobOptions: (queueName, job) => ({
        ...registryOptions(queueName, job),
        backoff: { type: 'exponential', delay: backoffMs },
      }),
    });
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await afterE2eInit(server);
    await sql(EFFECT_TABLE_DDL);
    adminClient.setChannelToken(E2E_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    const suffix = Date.now().toString(36);
    const provisioned = await adminClient.query<{ provisionBusiness: { business: { id: string } } }>(
      PROVISION_BUSINESS,
      {
        input: {
          name: 'loss SARL',
          owner: {
            emailAddress: `loss-owner-${suffix}@example.test`,
            firstName: 'loss',
            lastName: 'Owner',
            password: 'synthetic-fixture-owner-password',
          },
          store: { name: 'loss store', subdomain: `loss-${suffix}`, language: 'ar' },
        },
      },
    );
    businessId = provisioned.provisionBusiness.business.id;
    effectAccounts.set(ACCOUNT_KEY, { accountId: 'acct-loss', businessId: toBusinessId(businessId) });
  }, 120_000);

  afterAll(async () => {
    try {
      await server.destroy();
    } finally {
      try {
        // Only this file's database; never FLUSHALL.
        if (redis.options.db === VALKEY_TEST_DATABASE) await redis.flushdb();
      } finally {
        redis.disconnect();
      }
    }
  });

  it('runs every row to its end after FLUSHDB, once each, and a second reconcile finds nothing', async () => {
    // Arrange (1): a delivery whose BullMQ job is kept as failed. A last-attempt handler failure ends the row but
    // completes the job, so the job fails the way a crash does: its row does not exist yet while it runs (the
    // processor throws before the handler) and is inserted afterwards, `enqueued`, as a lost final update leaves it.
    backoffMs = SHORT_BACKOFF_MS;
    const ref = await commitEventRef('order.delivered', { n: -1 });
    const keptJobId = `od-${ref.id}-${CRITICAL_EFFECT_CONSUMER}`;
    await server.app.get(PlatformQueues).add('order-effects', {
      jobId: keptJobId,
      outboxId: ref.id,
      createdAt: ref.createdAt,
      businessId,
      consumer: CRITICAL_EFFECT_CONSUMER,
    });
    await until(async () =>
      (await bullQueue('critical')
        .getJob(keptJobId)
        .then((job) => job?.getState())) === 'failed'
        ? true
        : undefined,
    );
    // Stamped a minute back on the test's clock, so the reconcile below sees it as untouched for its sweep delay. Postgres
    // now() carries microseconds: within the same millisecond as `later()` it would fall just past the scan's cutoff.
    const enqueuedAt = new Date(Date.now() - MINUTE_MS);
    await sql(
      `INSERT INTO "outbox_delivery"
         ("businessId", "createdAt", "outboxId", "consumer", "status", "attempts", "enqueuedAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'enqueued', 0, $5, $5)`,
      [businessId, ref.createdAt, ref.id, CRITICAL_EFFECT_CONSUMER, enqueuedAt],
    );

    // Act (1): the reconciler removes the kept job and adds it again through the real job presence.
    const first = await server.app.get(JobReconciler).reconcile(later());

    // Assert (1)
    expect(first.reenqueued).toBe(1);
    await until(async () => ((await countWhere('outbox_delivery', `"status" = 'done'`)) === 1 ? true : undefined));

    // Arrange (2): deliveries enqueued with jobs waiting, delayed and retrying; webhooks and events with jobs waiting.
    backoffMs = LONG_BACKOFF_MS;
    await bullQueue('bulk').pause();
    for (let i = 0; i < BULK_EVENTS; i += 1) await commitEvent(BULK_EFFECT_TOPIC, { n: i });
    const retryingIds: string[] = [];
    for (let i = 0; i < DELAYED_EVENTS; i += 1) {
      const id = await commitEvent(CRITICAL_EFFECT_TOPIC, { failUntilAttempt: i < RETRYING_EVENTS ? 2 : 1 });
      if (i < RETRYING_EVENTS) retryingIds.push(id);
    }
    await until(async () => {
      const rows = await deliveryRows();
      const critical = rows.filter((row) => row['consumer'] === CRITICAL_EFFECT_CONSUMER && row['status'] !== 'done');
      const bulk = rows.filter((row) => row['consumer'] === BULK_EFFECT_CONSUMER);
      const ready = critical.length === DELAYED_EVENTS && critical.every((row) => Number(row['attempts']) >= 1);
      return ready && bulk.length === BULK_EVENTS ? true : undefined;
    });
    // Promote exactly the events committed with failUntilAttempt 2, picked by id: they run a second time and are
    // delayed again (retrying rows). Promoting any other delayed job would finish its delivery instead.
    for (const id of retryingIds) {
      const job = await bullQueue('critical').getJob(`od-${id}-${CRITICAL_EFFECT_CONSUMER}`);
      await job?.promote();
    }
    await until(async () =>
      (await countWhere('outbox_delivery', `"attempts" = 2`)) === RETRYING_EVENTS ? true : undefined,
    );
    await bullQueue('critical').pause();
    for (let n = 0; n < WEBHOOKS; n += 1) await postWebhook(n);
    for (let i = 0; i < PENDING_EVENTS; i += 1) {
      await commitEvent(i % 2 === 0 ? BULK_EFFECT_TOPIC : CRITICAL_EFFECT_TOPIC, { n: i });
    }
    await until(async () => ((await jobCount('critical')) >= WEBHOOKS + PENDING_EVENTS ? true : undefined));
    expect(await countWhere('outbox_event', `"status" = 'pending'`)).toBe(PENDING_EVENTS);
    expect(await countWhere('inbound_webhook', `"status" = 'received'`)).toBe(WEBHOOKS);
    expect(await countWhere('outbox_delivery', `"status" = 'enqueued'`)).toBe(BULK_EVENTS + DELAYED_EVENTS);

    // Act (2): Valkey loses everything, the workers resume, the reconciler and the sweeper run.
    expect(redis.options.db).toBe(VALKEY_TEST_DATABASE);
    await redis.flushdb();
    await bullQueue('critical').resume();
    await bullQueue('bulk').resume();
    const reconciled = await server.app.get(JobReconciler).reconcile(later());
    const swept = await server.app.get(OutboxSweeper).sweep(later());
    await until(async () => {
      const open =
        (await countWhere('outbox_delivery', `"status" NOT IN ('done')`)) +
        (await countWhere('inbound_webhook', `"status" <> 'processed'`)) +
        (await countWhere('outbox_event', `"status" = 'pending'`));
      return open === 0 ? true : undefined;
    });

    // Assert (2)
    expect(reconciled.reenqueued).toBeGreaterThanOrEqual(BULK_EVENTS + DELAYED_EVENTS + WEBHOOKS);
    expect(swept.enqueued).toBe(PENDING_EVENTS);
    const deliveries = await deliveryRows();
    expect(deliveries).toHaveLength(1 + BULK_EVENTS + DELAYED_EVENTS + PENDING_EVENTS);
    expect(deliveries.every((row) => row['status'] === 'done')).toBe(true);
    const inbound = await sql(`SELECT "id"::text AS "id", "status" FROM "inbound_webhook"`);
    expect(inbound).toHaveLength(WEBHOOKS);
    expect(inbound.every((row) => row['status'] === 'processed')).toBe(true);
    const effects = (await sql(`SELECT "effectKey" FROM "e2e_effect_seen"`)).map((row) => String(row['effectKey']));
    const expected = [
      ...deliveries.map((row) => `${String(row['outboxId'])}:${String(row['consumer'])}`),
      ...inbound.map((row) => `iw:${String(row['id'])}`),
    ];
    expect([...effects].sort()).toEqual([...expected].sort());
    const again = await server.app.get(JobReconciler).reconcile(new Date(Date.now() + 2 * MINUTE_MS));
    expect(again).toEqual({ reenqueued: 0, exhausted: 0 });
  }, 150_000);
});
