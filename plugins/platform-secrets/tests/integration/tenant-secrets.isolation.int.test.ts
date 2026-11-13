import { RbacPlugin } from '@cod/plugin-rbac';
import { RequestTenantScope, TenancyPlugin } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import {
  adminOperationsOf,
  asChannel,
  type BusinessFixture,
  createPluginTestEnvironment,
  createTwoBusinesses,
  failureOf,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { adminApiSchema } from '../../api/schema';
import { TenantSecretService } from '../../application/tenant-secret.service';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';
import { TEST_PROVIDER, TestProviderPlugin } from '../fixtures/test-provider.plugin';
import {
  DELETE_TENANT_SECRET,
  PLAINTEXT_ONE,
  PLAINTEXT_TWO,
  SET_TENANT_SECRET,
  type SecretResult,
  TENANT_SECRETS,
  TEST_REDIS_URL,
  testKekRing,
  testJobsPlugin,
  testRateLimitPlugin,
} from './secrets-kit';

describe('tenant secrets isolation between two businesses', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      testJobsPlugin(),
      testRateLimitPlugin(),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1001 }),
      RbacPlugin,
      PlatformSecretsPlugin.init({ kekRing: testKekRing() }),
      TestProviderPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  let businesses: TwoBusinesses;
  let secretOfA: SecretResult;
  let secretOfB: SecretResult;

  const sql = (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

  async function asOwner(business: BusinessFixture): Promise<void> {
    adminClient.setChannelToken(business.stores[0].channelToken);
    await adminClient.asUserWithCredentials(business.owner.email, business.owner.password);
  }

  async function setAs(business: BusinessFixture, ref: string, value: string): Promise<SecretResult> {
    await asOwner(business);
    const { setTenantSecret } = await adminClient.query<{ setTenantSecret: SecretResult }>(SET_TENANT_SECRET, {
      input: { provider: TEST_PROVIDER, ref, value },
    });
    return setTenantSecret;
  }

  const idsListedBy = async (business: BusinessFixture): Promise<string[]> => {
    await asOwner(business);
    const { tenantSecrets } = await adminClient.query<{ tenantSecrets: SecretResult[] }>(TENANT_SECRETS);
    return tenantSecrets.map((secret) => secret.id);
  };

  const reveal = async (business: BusinessFixture, ref: string): Promise<string> => {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    return server.app
      .get(TenantSecretService)
      .reveal(new RequestTenantScope(ctx, toBusinessId(business.businessId)), TEST_PROVIDER, ref);
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    secretOfA = await setAs(businesses.a, 'a-only', PLAINTEXT_ONE);
    secretOfB = await setAs(businesses.b, 'b-only', PLAINTEXT_TWO);
  }, 120_000);

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('has an isolation test for every Admin API operation', () => {
    // Act and Assert
    expect(adminOperationsOf(adminApiSchema)).toEqual(['deleteTenantSecret', 'setTenantSecret', 'tenantSecrets']);
  });

  it("lists B's own secrets for B and never A's, with a positive control", async () => {
    // Act
    const listedByB = await idsListedBy(businesses.b);
    const listedByA = await idsListedBy(businesses.a);

    // Assert
    expect(listedByB).toContain(secretOfB.id);
    expect(listedByB).not.toContain(secretOfA.id);
    expect(listedByA).toContain(secretOfA.id);
    expect(listedByA).not.toContain(secretOfB.id);
  });

  it("answers not found when B deletes A's secret, and A's row survives", async () => {
    // Arrange
    await asOwner(businesses.b);

    // Act
    const failure = await failureOf(adminClient.query(DELETE_TENANT_SECRET, { id: secretOfA.id }));

    // Assert
    expect(failure.codes).toEqual(['tenant-secret.not-found']);
    expect(await sql('SELECT id FROM tenant_secret WHERE id = $1', [secretOfA.id])).toHaveLength(1);
    expect(await reveal(businesses.a, 'a-only')).toBe(PLAINTEXT_ONE);
  });

  it("answers not found when B reveals A's provider and ref, while B's own reveals", async () => {
    // Act and Assert
    await expect(reveal(businesses.b, 'a-only')).rejects.toMatchObject({ code: 'tenant-secret.not-found' });
    expect(await reveal(businesses.b, 'b-only')).toBe(PLAINTEXT_TWO);
  });

  it("updates only the caller's row when B sets A's ref", async () => {
    // Act
    const created = await setAs(businesses.b, 'a-only', 'synthetic-plaintext-CCCC-3333');

    // Assert
    expect(created.id).not.toBe(secretOfA.id);
    expect(await reveal(businesses.a, 'a-only')).toBe(PLAINTEXT_ONE);
    expect(await reveal(businesses.b, 'a-only')).toBe('synthetic-plaintext-CCCC-3333');
  });

  it("cannot open A's ciphertext copied into B's row: tenant-secret.unreadable", async () => {
    // Arrange
    expect(await reveal(businesses.b, 'b-only')).toBe(PLAINTEXT_TWO);
    const [rowOfA] = await sql('SELECT iv, ciphertext, tag FROM tenant_secret WHERE id = $1', [secretOfA.id]);

    // Act
    await sql('UPDATE tenant_secret SET iv = $1, ciphertext = $2, tag = $3 WHERE id = $4', [
      rowOfA?.['iv'],
      rowOfA?.['ciphertext'],
      rowOfA?.['tag'],
      secretOfB.id,
    ]);

    // Assert
    await expect(reveal(businesses.b, 'b-only')).rejects.toMatchObject({ code: 'tenant-secret.unreadable' });
  });

  it("cannot open a row that points at A's data key: tenant-secret.unreadable", async () => {
    // Arrange
    const created = await setAs(businesses.b, 'pointer', PLAINTEXT_TWO);
    expect(await reveal(businesses.b, 'pointer')).toBe(PLAINTEXT_TWO);
    const [keyOfA] = await sql('SELECT id FROM tenant_data_key WHERE "businessId" = $1', [businesses.a.businessId]);

    // Act
    await sql('UPDATE tenant_secret SET "dataKeyId" = $1 WHERE id = $2', [keyOfA?.['id'], created.id]);

    // Assert
    await expect(reveal(businesses.b, 'pointer')).rejects.toMatchObject({ code: 'tenant-secret.unreadable' });
  });

  it('binds a value to its ref: swapping two refs of one business makes both unreadable', async () => {
    // Arrange
    await setAs(businesses.a, 'left', 'synthetic-plaintext-LEFT-0001');
    await setAs(businesses.a, 'right', 'synthetic-plaintext-RIGHT-0002');
    expect(await reveal(businesses.a, 'left')).toBe('synthetic-plaintext-LEFT-0001');
    const rows = await sql(
      `SELECT ref, iv, ciphertext, tag FROM tenant_secret WHERE "businessId" = $1 AND ref IN ('left', 'right')`,
      [businesses.a.businessId],
    );
    const byRef = Object.fromEntries(rows.map((row) => [row['ref'] as string, row]));

    // Act
    for (const [target, source] of [
      ['left', 'right'],
      ['right', 'left'],
    ] as const) {
      await sql('UPDATE tenant_secret SET iv = $1, ciphertext = $2, tag = $3 WHERE "businessId" = $4 AND ref = $5', [
        byRef[source]?.['iv'],
        byRef[source]?.['ciphertext'],
        byRef[source]?.['tag'],
        businesses.a.businessId,
        target,
      ]);
    }

    // Assert
    await expect(reveal(businesses.a, 'left')).rejects.toMatchObject({ code: 'tenant-secret.unreadable' });
    await expect(reveal(businesses.a, 'right')).rejects.toMatchObject({ code: 'tenant-secret.unreadable' });
  });

  it("is FORBIDDEN for A's owner on B's channel", async () => {
    // Arrange
    await asOwner(businesses.a);

    // Act
    const failure = await failureOf(
      asChannel(adminClient, businesses.b.stores[0].channelToken, () => adminClient.query(TENANT_SECRETS)),
    );

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it('is FORBIDDEN on the default channel, which belongs to no business', async () => {
    // Act
    const failure = await failureOf(adminClient.query(TENANT_SECRETS));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });
});
