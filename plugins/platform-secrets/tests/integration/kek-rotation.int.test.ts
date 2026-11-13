import { RbacPlugin } from '@cod/plugin-rbac';
import { RequestTenantScope, SNOWFLAKE_ID_GENERATOR, TenancyPlugin } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import {
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  loadPluginTestDbConfig,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
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
import { TenantSecretService } from '../../application/tenant-secret.service';
import { SECRET_PORTS } from '../../application/tokens';
import type { SecretPorts } from '../../application/tenant-secret.service';
import { SecretUnreadableError } from '../../domain/errors';
import type { KekRing } from '../../domain/ports/envelope-cipher.port';
import { parseKekRing } from '../../infrastructure/kek-ring';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';
import { TEST_PROVIDER, TestProviderPlugin } from '../fixtures/test-provider.plugin';
import { TEST_REDIS_URL, testJobsPlugin, testRateLimitPlugin } from './secrets-kit';

const SNOWFLAKE_WORKER_ID = 1003;
const KEK_ONE = `k1:${'11'.repeat(32)}`;
const KEK_TWO = `k2:${'22'.repeat(32)}`;
const MAINTENANCE_QUEUE = 'platform-maintenance';

const ringOf = (keks: string, active: string): KekRing => parseKekRing(keks, active);
/** The deployment's ring during a rotation: both keys, the new one active. */
const ROTATING = ringOf(`${KEK_ONE},${KEK_TWO}`, 'k2');
const ONLY_OLD = ringOf(KEK_ONE, 'k1');
const ONLY_NEW = ringOf(KEK_TWO, 'k2');

const VALUES = {
  aFirst: 'synthetic-rotation-A-one-1111',
  aSecond: 'synthetic-rotation-A-two-2222',
  bFirst: 'synthetic-rotation-B-one-3333',
  bSecond: 'synthetic-rotation-B-two-4444',
} as const;

interface DataKeyRow {
  readonly kid: string;
  readonly rotatedAt: Date | null;
  readonly version: string;
}

describe('kek rotation', () => {
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
  let first: TwoBusinesses;
  let second: TwoBusinesses;

  const sql = (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

  const rotation = (): KekRotationService => server.app.get(KekRotationService);

  /** The secret service of this server, but holding another ring: a deployment at another point of the rotation. */
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

  const put = async (service: TenantSecretService, business: BusinessFixture, ref: string, value: string) =>
    service.put(await scopeOf(business), { provider: TEST_PROVIDER, ref, value });

  const reveal = async (service: TenantSecretService, business: BusinessFixture, ref: string): Promise<string> =>
    service.reveal(await scopeOf(business), TEST_PROVIDER, ref);

  const dataKeyOf = async (business: BusinessFixture): Promise<DataKeyRow> => {
    const rows = await sql(
      `SELECT "kid", "rotatedAt", xmin::text AS "version" FROM "tenant_data_key" WHERE "businessId" = $1`,
      [business.businessId],
    );
    return rows[0] as unknown as DataKeyRow;
  };

  const kidsOf = async (...businesses: BusinessFixture[]): Promise<string[]> =>
    Promise.all(businesses.map(async (business) => (await dataKeyOf(business)).kid));

  const maintenanceJobIds = async (): Promise<string[]> => {
    const strategy = server.app.get(ConfigService).jobQueueOptions.jobQueueStrategy as InspectableJobQueueStrategy;
    const { items } = await strategy.findMany({ take: 1000 });
    return items
      .filter((job) => job.queueName === MAINTENANCE_QUEUE)
      .map((job) => (job.data as { jobId: string }).jobId);
  };

  /** Polls until every business's data key carries `kid`. */
  async function untilOn(kid: string, ...businesses: BusinessFixture[]): Promise<void> {
    const deadline = Date.now() + 20_000;
    while (!(await kidsOf(...businesses)).every((current) => current === kid)) {
      if (Date.now() > deadline) throw new Error(`the data keys did not move to ${kid} in time`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    first = await createTwoBusinesses(adminClient);
    const old = serviceWith(ONLY_OLD);
    await put(old, first.a, 'one', VALUES.aFirst);
    await put(old, first.a, 'two', VALUES.aSecond);
    await put(old, first.b, 'one', VALUES.bFirst);
    await put(old, first.b, 'two', VALUES.bSecond);
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('starts with both data keys wrapped by the old key', async () => {
    // Act
    const kids = await kidsOf(first.a, first.b);

    // Assert
    expect(kids).toEqual(['k1', 'k1']);
  });

  it('queues one rewrap job per data key off the active key, with the id kek-{business}-{kid}', async () => {
    // Act
    const result = await rotation().enqueueStale(new Date());

    // Assert
    expect(result.enqueued).toBe(2);
    const ids = await maintenanceJobIds();
    expect(ids).toContain(`kek-${first.a.businessId}-k2`);
    expect(ids).toContain(`kek-${first.b.businessId}-k2`);
  });

  it('moves both data keys to the active key and every secret still reveals its value', async () => {
    // Act
    await untilOn('k2', first.a, first.b);

    // Assert
    const service = serviceWith(ROTATING);
    expect(await reveal(service, first.a, 'one')).toBe(VALUES.aFirst);
    expect(await reveal(service, first.a, 'two')).toBe(VALUES.aSecond);
    expect(await reveal(service, first.b, 'one')).toBe(VALUES.bFirst);
    expect(await reveal(service, first.b, 'two')).toBe(VALUES.bSecond);
    expect((await dataKeyOf(first.a)).rotatedAt).toBeInstanceOf(Date);
    expect((await dataKeyOf(first.b)).rotatedAt).toBeInstanceOf(Date);
  });

  it('queues nothing a second time and reports nothing left on a retired key', async () => {
    // Act
    const result = await rotation().enqueueStale(new Date());

    // Assert
    expect(result).toEqual({ enqueued: 0, remainingOnRetiredKeks: 0 });
  });

  it('reveals everything with the new key alone', async () => {
    // Act
    const service = serviceWith(ONLY_NEW);

    // Assert
    expect(await reveal(service, first.a, 'one')).toBe(VALUES.aFirst);
    expect(await reveal(service, first.b, 'two')).toBe(VALUES.bSecond);
  });

  it('refuses to read with the old key alone: the data keys were really re-wrapped', async () => {
    // Act
    const service = serviceWith(ONLY_OLD);

    // Assert
    await expect(reveal(service, first.a, 'one')).rejects.toBeInstanceOf(SecretUnreadableError);
    await expect(reveal(service, first.b, 'one')).rejects.toMatchObject({ code: 'tenant-secret.unreadable' });
  });

  describe('rewrap of one business', () => {
    beforeAll(async () => {
      second = await createTwoBusinesses(adminClient);
      const old = serviceWith(ONLY_OLD);
      await put(old, second.a, 'one', VALUES.aFirst);
      await put(old, second.b, 'one', VALUES.bFirst);
    }, 120_000);

    it('never touches the data key or the secrets of another business', async () => {
      // Arrange
      const secretVersions = (business: BusinessFixture) =>
        sql(`SELECT "id"::text AS "id", xmin::text AS "version" FROM "tenant_secret" WHERE "businessId" = $1`, [
          business.businessId,
        ]);
      const untouchedKey = await dataKeyOf(second.b);
      const untouchedSecrets = await secretVersions(second.b);
      const target = await dataKeyOf(second.a);

      // Act
      const outcome = await rotation().rewrap(toBusinessId(second.a.businessId), ROTATING);

      // Assert
      expect(outcome).toBe('rewrapped');
      expect(await dataKeyOf(second.b)).toEqual(untouchedKey);
      expect(await secretVersions(second.b)).toEqual(untouchedSecrets);
      expect(untouchedKey.kid).toBe('k1');
      const moved = await dataKeyOf(second.a);
      expect(moved.kid).toBe('k2');
      expect(moved.version).not.toBe(target.version);
    });

    it('answers current and writes nothing when the data key is already on the active key', async () => {
      // Arrange
      const before = await dataKeyOf(second.a);

      // Act
      const outcome = await rotation().rewrap(toBusinessId(second.a.businessId), ROTATING);

      // Assert
      expect(outcome).toBe('current');
      expect(await dataKeyOf(second.a)).toEqual(before);
    });

    it('leaves the row alone and fails unreadable when the key that wrapped it left the ring', async () => {
      // Arrange
      const before = await dataKeyOf(second.b);

      // Act
      const attempt = rotation().rewrap(toBusinessId(second.b.businessId), ONLY_NEW);

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(SecretUnreadableError);
      expect(await dataKeyOf(second.b)).toEqual(before);
    });

    it('answers current for a business that has no data key yet', async () => {
      // Arrange: a business that never stored a secret
      const fresh = await createTwoBusinesses(adminClient);

      // Act
      const outcome = await rotation().rewrap(toBusinessId(fresh.a.businessId), ROTATING);

      // Assert
      expect(outcome).toBe('current');
    });

    it('lets two concurrent rewraps of one business end with one rewrap and one current', async () => {
      // Act
      const outcomes = await Promise.all([
        rotation().rewrap(toBusinessId(second.b.businessId), ROTATING),
        rotation().rewrap(toBusinessId(second.b.businessId), ROTATING),
      ]);

      // Assert
      expect([...outcomes].sort()).toEqual(['current', 'rewrapped']);
      expect(await reveal(serviceWith(ONLY_NEW), second.b, 'one')).toBe(VALUES.bFirst);
    });
  });
});
