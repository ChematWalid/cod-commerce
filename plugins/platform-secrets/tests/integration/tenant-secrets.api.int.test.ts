import { RbacPlugin } from '@cod/plugin-rbac';
import { RequestTenantScope, TenancyPlugin } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import {
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
import { TenantSecretService } from '../../application/tenant-secret.service';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';
import { TEST_PROVIDER, TestProviderPlugin } from '../fixtures/test-provider.plugin';
import { declaredOperations } from './declared-handlers';
import {
  DELETE_TENANT_SECRET,
  PLAINTEXT_ONE,
  PLAINTEXT_TWO,
  SET_TENANT_SECRET,
  type SecretResult,
  SecretMembers,
  TENANT_SECRETS,
  TEST_REDIS_URL,
  testKekRing,
  testRateLimitPlugin,
} from './secrets-kit';

const SNOWFLAKE_ID = /^[1-9][0-9]{0,18}$/;

describe('tenant secrets Admin API', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      testRateLimitPlugin(),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1000 }),
      RbacPlugin,
      PlatformSecretsPlugin.init({ kekRing: testKekRing() }),
      TestProviderPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  let businesses: TwoBusinesses;
  let members: SecretMembers;

  const sql = (statement: string, parameters: unknown[] = []): Promise<Record<string, unknown>[]> =>
    server.app.get(TransactionalConnection).rawConnection.query(statement, parameters);

  const set = async (ref: string, value: string): Promise<SecretResult> => {
    const { setTenantSecret } = await adminClient.query<{ setTenantSecret: SecretResult }>(SET_TENANT_SECRET, {
      input: { provider: TEST_PROVIDER, ref, value },
    });
    return setTenantSecret;
  };

  const list = async (): Promise<SecretResult[]> =>
    (await adminClient.query<{ tenantSecrets: SecretResult[] }>(TENANT_SECRETS)).tenantSecrets;

  const reveal = async (businessId: string, ref: string): Promise<string> => {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    return server.app
      .get(TenantSecretService)
      .reveal(new RequestTenantScope(ctx, toBusinessId(businessId)), TEST_PROVIDER, ref);
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    members = new SecretMembers(server.app, adminClient, businesses.a);
  }, 120_000);

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('declares exactly the three handlers, each behind a catalogue permission', () => {
    // Act
    const handlers = declaredOperations();

    // Assert
    expect(handlers.map((handler) => handler.key).sort()).toEqual([
      'deleteTenantSecret',
      'setTenantSecret',
      'tenantSecrets',
    ]);
    expect(handlers.find((handler) => handler.key === 'tenantSecrets')?.allow).toBe('CodAppsView');
    expect(handlers.find((handler) => handler.key === 'setTenantSecret')?.allow).toBe('CodAppsManage');
    expect(handlers.find((handler) => handler.key === 'deleteTenantSecret')?.allow).toBe('CodAppsManage');
  });

  it('lets an owner set a secret and list it with its last four characters', async () => {
    // Arrange
    await members.asOwner();

    // Act
    const created = await set('primary', PLAINTEXT_ONE);
    const listed = await list();

    // Assert
    expect(created).toMatchObject({ provider: TEST_PROVIDER, ref: 'primary', last4: PLAINTEXT_ONE.slice(-4) });
    expect(created.id).toMatch(SNOWFLAKE_ID);
    expect(listed).toEqual([created]);
    expect(await reveal(businesses.a.businessId, 'primary')).toBe(PLAINTEXT_ONE);
  });

  it('keeps no last four characters for a value under 12 characters', async () => {
    // Arrange
    await members.asOwner();

    // Act
    const created = await set('short', 'abc123');

    // Assert
    expect(created.last4).toBeNull();
    expect(await reveal(businesses.a.businessId, 'short')).toBe('abc123');
  });

  it('keeps the id when a secret is set again, and reveals the new value', async () => {
    // Arrange
    await members.asOwner();
    const first = await set('rotating', PLAINTEXT_ONE);

    // Act
    const second = await set('rotating', PLAINTEXT_TWO);

    // Assert
    expect(second.id).toBe(first.id);
    expect(second.last4).toBe(PLAINTEXT_TWO.slice(-4));
    expect(await reveal(businesses.a.businessId, 'rotating')).toBe(PLAINTEXT_TWO);
    expect((await list()).filter((secret) => secret.ref === 'rotating')).toHaveLength(1);
  });

  it('deletes a secret, which can then no longer be revealed', async () => {
    // Arrange
    await members.asOwner();
    const created = await set('doomed', PLAINTEXT_ONE);

    // Act
    const { deleteTenantSecret } = await adminClient.query<{ deleteTenantSecret: boolean }>(DELETE_TENANT_SECRET, {
      id: created.id,
    });

    // Assert
    expect(deleteTenantSecret).toBe(true);
    expect((await list()).map((secret) => secret.id)).not.toContain(created.id);
    await expect(reveal(businesses.a.businessId, 'doomed')).rejects.toMatchObject({ code: 'tenant-secret.not-found' });
  });

  it('answers not found when deleting an id that does not exist', async () => {
    // Arrange
    await members.asOwner();

    // Act
    const failure = await failureOf(adminClient.query(DELETE_TENANT_SECRET, { id: '9000000000000000001' }));

    // Assert
    expect(failure.codes).toEqual(['tenant-secret.not-found']);
  });

  it('refuses a provider nobody registered', async () => {
    // Arrange
    await members.asOwner();

    // Act
    const failure = await failureOf(
      adminClient.query(SET_TENANT_SECRET, { input: { provider: 'nope', ref: 'primary', value: PLAINTEXT_ONE } }),
    );

    // Assert
    expect(failure.codes).toEqual(['tenant-secret.unknown-provider']);
  });

  it.each([
    ['a ref the provider refuses', 'Not A Valid Ref!', PLAINTEXT_ONE],
    ['an empty value', 'primary', ''],
    ['a value over 4096 bytes', 'primary', 'a'.repeat(4097)],
  ])('refuses %s as an invalid value', async (_name, ref, value) => {
    // Arrange
    await members.asOwner();

    // Act
    const failure = await failureOf(
      adminClient.query(SET_TENANT_SECRET, { input: { provider: TEST_PROVIDER, ref, value } }),
    );

    // Assert
    expect(failure.codes).toEqual(['tenant-secret.invalid-value']);
  });

  it('shares one data key when two first puts of a new business run together, and both secrets reveal', async () => {
    // Arrange: business B has stored nothing yet
    const businessId = businesses.b.businessId;
    await sql('DELETE FROM tenant_secret WHERE "businessId" = $1', [businessId]);
    await sql('DELETE FROM tenant_data_key WHERE "businessId" = $1', [businessId]);
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    const scope = new RequestTenantScope(ctx, toBusinessId(businessId));
    const service = server.app.get(TenantSecretService);

    // Act
    await Promise.all([
      service.put(scope, { provider: TEST_PROVIDER, ref: 'first', value: PLAINTEXT_ONE }),
      service.put(scope, { provider: TEST_PROVIDER, ref: 'second', value: PLAINTEXT_TWO }),
    ]);

    // Assert
    const keys = await sql('SELECT id FROM tenant_data_key WHERE "businessId" = $1', [businessId]);
    expect(keys).toHaveLength(1);
    expect(await reveal(businessId, 'first')).toBe(PLAINTEXT_ONE);
    expect(await reveal(businessId, 'second')).toBe(PLAINTEXT_TWO);
  });

  it('stores only ciphertext: the plaintext is nowhere in the tables', async () => {
    // Act
    const rows = await sql('SELECT iv, ciphertext, tag FROM tenant_secret');
    const keys = await sql('SELECT iv, "wrappedKey", tag FROM tenant_data_key');

    // Assert
    expect(rows.length).toBeGreaterThan(0);
    expect(keys.length).toBeGreaterThan(0);
    for (const row of [...rows, ...keys]) {
      for (const column of Object.values(row)) {
        expect((column as Buffer).toString('latin1')).not.toContain('synthetic-plaintext');
      }
    }
  });
});
