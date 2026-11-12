import { PlatformQueues } from '@cod/plugin-platform-jobs';
import { RbacPlugin } from '@cod/plugin-rbac';
import { RequestTenantScope, SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
} from '@cod/testing';
import {
  ConfigService,
  type InspectableJobQueueStrategy,
  RequestContextService,
  TransactionalConnection,
} from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KekRotationService } from '../../application/kek-rotation.service';
import { TenantSecretProviderRegistry } from '../../application/provider-registry';
import { type SecretPorts, TenantSecretService } from '../../application/tenant-secret.service';
import { ENVELOPE_CIPHER, KEK_REWRAP_STORE, RETIRED_KEK_SCAN, SECRET_PORTS } from '../../application/tokens';
import type { EnvelopeCipherPort, KekRing } from '../../domain/ports/envelope-cipher.port';
import type { KekRewrapStorePort, RetiredKekScanPort } from '../../domain/ports/kek-rotation.ports';
import { PlatformKekRewrapQueue } from '../../infrastructure/kek-rewrap.job';
import { parseKekRing } from '../../infrastructure/kek-ring';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';
import { FakeJobPresence } from '../fixtures/fake-job-presence';
import { TEST_PROVIDER, TestProviderPlugin } from '../fixtures/test-provider.plugin';
import { TEST_REDIS_URL, testJobsPlugin, testRateLimitPlugin } from './secrets-kit';

const SNOWFLAKE_WORKER_ID = 1023;
const KEK_ONE = `k1:${'11'.repeat(32)}`;
const KEK_TWO = `k2:${'22'.repeat(32)}`;
const MAINTENANCE_QUEUE = 'platform-maintenance';
const SYNTHETIC_VALUE = 'synthetic-failed-rewrap-5555';
const ROTATING = parseKekRing(`${KEK_ONE},${KEK_TWO}`, 'k2');
const ONLY_OLD = parseKekRing(KEK_ONE, 'k1');
const ONLY_NEW = parseKekRing(KEK_TWO, 'k2');

describe('kek rotation after a rewrap job failed for good', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      testJobsPlugin(),
      testRateLimitPlugin(),
      TenancyPlugin.init({
        redisUrl: TEST_REDIS_URL,
        platformDomain: 'localhost',
        snowflakeWorkerId: SNOWFLAKE_WORKER_ID,
      }),
      RbacPlugin,
      PlatformSecretsPlugin.init({ kekRing: ROTATING }),
      TestProviderPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });

  const sql = (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

  const serviceWith = (ring: KekRing): TenantSecretService =>
    new TenantSecretService({
      ...server.app.get<SecretPorts>(SECRET_PORTS, { strict: false }),
      providers: server.app.get(TenantSecretProviderRegistry),
      ring,
      ids: server.app.get(SNOWFLAKE_ID_GENERATOR, { strict: false }),
    });

  const scopeOf = async (business: BusinessFixture): Promise<RequestTenantScope> => {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    return new RequestTenantScope(ctx, toBusinessId(business.businessId));
  };

  const putOnOldKey = async (business: BusinessFixture): Promise<void> => {
    await serviceWith(ONLY_OLD).put(await scopeOf(business), {
      provider: TEST_PROVIDER,
      ref: 'one',
      value: SYNTHETIC_VALUE,
    });
  };

  const kidOf = async (business: BusinessFixture): Promise<string> => {
    const rows = await sql(`SELECT "kid" FROM "tenant_data_key" WHERE "businessId" = $1`, [business.businessId]);
    return (rows[0] as { kid: string }).kid;
  };

  const maintenanceJobIds = async (): Promise<string[]> => {
    const strategy = server.app.get(ConfigService).jobQueueOptions.jobQueueStrategy as InspectableJobQueueStrategy;
    const { items } = await strategy.findMany({ take: 1000 });
    return items
      .filter((job) => job.queueName === MAINTENANCE_QUEUE)
      .map((job) => (job.data as { jobId: string }).jobId);
  };

  async function untilOnNewKey(business: BusinessFixture): Promise<void> {
    const deadline = Date.now() + 20_000;
    while ((await kidOf(business)) !== 'k2') {
      if (Date.now() > deadline) throw new Error('the data key did not move to k2 in time');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /** This server's rotation, with its queue asking `presence` about jobs instead of a BullMQ pool. */
  const rotationOver = (presence: FakeJobPresence, warnings: string[]): KekRotationService => {
    const logger = { warn: (message: string) => warnings.push(message) };
    return new KekRotationService({
      scan: server.app.get<RetiredKekScanPort>(RETIRED_KEK_SCAN, { strict: false }),
      store: server.app.get<KekRewrapStorePort>(KEK_REWRAP_STORE, { strict: false }),
      queue: new PlatformKekRewrapQueue(server.app.get(PlatformQueues), presence, logger),
      logger,
      ring: ROTATING,
      cipher: server.app.get<EnvelopeCipherPort>(ENVELOPE_CIPHER, { strict: false }),
      clock: { now: () => Date.now() },
    });
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('removes the failed job and adds it again when a rerun finds the business still on the retired key', async () => {
    // Arrange: BullMQ ignores an add of this id for 14 days while the failed job still holds it.
    const { a } = await createTwoBusinesses(adminClient);
    await putOnOldKey(a);
    const jobId = `kek-${a.businessId}-k2`;
    const presence = new FakeJobPresence(new Set([jobId]));
    const warnings: string[] = [];

    // Act
    const result = await rotationOver(presence, warnings).enqueueStale(new Date());

    // Assert
    expect(result.enqueued).toBe(1);
    expect(presence.removed).toEqual([jobId]);
    expect(await maintenanceJobIds()).toContain(jobId);
    await untilOnNewKey(a);
    expect(await serviceWith(ONLY_NEW).reveal(await scopeOf(a), TEST_PROVIDER, 'one')).toBe(SYNTHETIC_VALUE);
    expect(warnings.filter((message) => message.includes(jobId))).toHaveLength(1);
    expect(warnings.join('\n')).not.toContain(SYNTHETIC_VALUE);
  });

  it('leaves a job alone that BullMQ does not hold as failed', async () => {
    // Arrange
    const { a } = await createTwoBusinesses(adminClient);
    await putOnOldKey(a);
    const presence = new FakeJobPresence(new Set());

    // Act
    await rotationOver(presence, []).enqueueStale(new Date());

    // Assert
    expect(presence.removed).toEqual([]);
    await untilOnNewKey(a);
  });
});
