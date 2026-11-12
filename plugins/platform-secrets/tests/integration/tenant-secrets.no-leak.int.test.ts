import { PartitionMaintenanceService, PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { RequestTenantScope, TenancyPlugin } from '@cod/plugin-tenancy';
import { toBusinessId } from '@cod/shared';
import {
  createPluginTestEnvironment,
  createTwoBusinesses,
  ensurePartitionedSchema,
  failureOf,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { Logger, NoopLogger, RequestContextService, TransactionalConnection, type VendureLogger } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TenantSecretService } from '../../application/tenant-secret.service';
import { PlatformSecretsPlugin } from '../../platform-secrets.plugin';
import { TEST_PROVIDER, TestProviderPlugin } from '../fixtures/test-provider.plugin';
import {
  DELETE_TENANT_SECRET,
  PLAINTEXT_ONE,
  SecretMembers,
  SET_TENANT_SECRET,
  type SecretResult,
  TENANT_SECRETS,
  TEST_REDIS_URL,
  testKekRing,
  testJobsPlugin,
  testRateLimitPlugin,
} from './secrets-kit';

/**
 * Makes `server.init` also create the partitioned `activity_log` and its current partitions (D106, D123): `synchronize`
 * cannot, and the business-role mutations the member tests call write an activity entry.
 */
function withActivityLog(server: ReturnType<typeof createPluginTestEnvironment>['server']): void {
  const init = server.init.bind(server);
  server.init = async (...args: Parameters<typeof init>): Promise<void> => {
    await init(...args);
    await ensurePartitionedSchema(server.app.get(TransactionalConnection).rawConnection, [ACTIVITY_LOG_SCHEMA]);
    await server.app.get(PartitionMaintenanceService).maintain(new Date());
  };
}

/** Records every line any component logs, at any level. */
class RecordingLogger implements VendureLogger {
  readonly lines: string[] = [];

  private record(level: string, message: string | Error, context?: string): void {
    this.lines.push(
      `${level} ${context ?? ''} ${message instanceof Error ? `${message.message}\n${message.stack ?? ''}` : message}`,
    );
  }

  error(message: string | Error, context?: string): void {
    this.record('error', message, context);
  }
  warn(message: string | Error, context?: string): void {
    this.record('warn', message, context);
  }
  info(message: string | Error, context?: string): void {
    this.record('info', message, context);
  }
  verbose(message: string | Error, context?: string): void {
    this.record('verbose', message, context);
  }
  debug(message: string | Error, context?: string): void {
    this.record('debug', message, context);
  }
}

const TYPE_FIELDS = gql`
  query ($name: String!) {
    __type(name: $name) {
      fields {
        name
      }
      inputFields {
        name
      }
    }
  }
`;

const ROOT_FIELDS = gql`
  query {
    query: __type(name: "Query") {
      fields {
        name
        type {
          name
          ofType {
            name
            ofType {
              name
              ofType {
                name
              }
            }
          }
        }
      }
    }
  }
`;

const SECRET_LIKE_NAME = /value|cipher|key|secret/i;

describe('tenant secrets never leak', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [
      PlatformPartitionsPlugin,
      testJobsPlugin(),
      testRateLimitPlugin(),
      TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1002 }),
      RbacPlugin,
      PlatformSecretsPlugin.init({ kekRing: testKekRing() }),
      TestProviderPlugin,
    ],
    db: loadPluginTestDbConfig(process.env),
  });
  withActivityLog(server);
  let businesses: TwoBusinesses;
  let members: SecretMembers;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    members = new SecretMembers(server.app, adminClient, businesses.a);
  }, 120_000);

  afterEach(async () => {
    Logger.useLogger(new NoopLogger());
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('exposes no field of TenantSecret named like a value, a cipher, a key or a secret', async () => {
    // Act
    const { __type: secret } = await adminClient.query<{ __type: { fields: { name: string }[] } }>(TYPE_FIELDS, {
      name: 'TenantSecret',
    });
    const names = secret.fields.map((field) => field.name);

    // Assert
    expect(names.sort()).toEqual(['id', 'last4', 'provider', 'ref', 'updatedAt']);
    expect(names.filter((name) => SECRET_LIKE_NAME.test(name))).toEqual([]);
  });

  it('takes the value only as input, and no query returns anything but TenantSecret', async () => {
    // Act
    const { __type: input } = await adminClient.query<{ __type: { inputFields: { name: string }[] } }>(TYPE_FIELDS, {
      name: 'SetTenantSecretInput',
    });
    const { query } = await adminClient.query<{
      query: { fields: { name: string; type: { name: string | null; ofType: { name: string | null } | null } }[] };
    }>(ROOT_FIELDS);
    const secretQueries = query.fields.filter((field) => field.name.toLowerCase().includes('tenantsecret'));

    // Assert
    expect(input.inputFields.map((field) => field.name).sort()).toEqual(['provider', 'ref', 'value']);
    expect(secretQueries.map((field) => field.name)).toEqual(['tenantSecrets']);
  });

  it('logs no line holding the plaintext, its base64 or its hex across put, list, reveal and a failed reveal', async () => {
    // Arrange
    const recorder = new RecordingLogger();
    const plaintext = `${PLAINTEXT_ONE}-leak-probe`;
    const encodings = [
      plaintext,
      Buffer.from(plaintext, 'utf8').toString('base64'),
      Buffer.from(plaintext, 'utf8').toString('base64url'),
      Buffer.from(plaintext, 'utf8').toString('hex'),
      'leak-probe',
      'x'.repeat(100),
    ];
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    const scope = new RequestTenantScope(ctx, toBusinessId(businesses.a.businessId));
    const service = server.app.get(TenantSecretService);
    await members.asOwner();
    Logger.useLogger(recorder);

    // Act
    const { setTenantSecret } = await adminClient.query<{ setTenantSecret: SecretResult }>(SET_TENANT_SECRET, {
      input: { provider: TEST_PROVIDER, ref: 'probe', value: plaintext },
    });
    await adminClient.query(TENANT_SECRETS);
    const revealed = await service.reveal(scope, TEST_PROVIDER, 'probe');
    const missing = await service.reveal(scope, TEST_PROVIDER, 'absent').catch((error: unknown) => error);
    await failureOf(
      adminClient.query(SET_TENANT_SECRET, {
        input: { provider: TEST_PROVIDER, ref: 'probe', value: 'x'.repeat(5000) },
      }),
    );
    const connection = server.app.get(TransactionalConnection).rawConnection;
    await connection.query(`UPDATE tenant_secret SET tag = '\\x00112233445566778899aabbccddeeff' WHERE id = $1`, [
      setTenantSecret.id,
    ]);
    const unreadable = await service.reveal(scope, TEST_PROVIDER, 'probe').catch((error: unknown) => error);
    await adminClient.query(DELETE_TENANT_SECRET, { id: setTenantSecret.id });

    // Assert: the controls first, so an empty recorder cannot pass
    expect(revealed).toBe(plaintext);
    expect(missing).toMatchObject({ code: 'tenant-secret.not-found' });
    expect(unreadable).toMatchObject({ code: 'tenant-secret.unreadable' });
    expect(recorder.lines.length).toBeGreaterThan(0);
    for (const line of recorder.lines) {
      for (const encoding of encodings) {
        expect(line).not.toContain(encoding);
      }
    }
    for (const error of [missing, unreadable]) {
      for (const encoding of encodings) {
        expect((error as Error).message).not.toContain(encoding);
      }
    }
  });

  it('answers a member without apps.manage with the permission error, and lets apps.view list', async () => {
    // Arrange
    await members.signInWith('viewer', { name: 'Secrets viewer', grants: ['apps.view'] });

    // Act
    const listed = await adminClient.query<{ tenantSecrets: SecretResult[] }>(TENANT_SECRETS);
    const setFailure = await failureOf(
      adminClient.query(SET_TENANT_SECRET, {
        input: { provider: TEST_PROVIDER, ref: 'denied', value: PLAINTEXT_ONE },
      }),
    );
    const deleteFailure = await failureOf(adminClient.query(DELETE_TENANT_SECRET, { id: '1' }));

    // Assert
    expect(Array.isArray(listed.tenantSecrets)).toBe(true);
    expect(setFailure.codes).toEqual(['FORBIDDEN']);
    expect(deleteFailure.codes).toEqual(['FORBIDDEN']);
  });

  it('answers a member without apps.view with the permission error on the list', async () => {
    // Arrange
    await members.signInWith('outsider', { name: 'No secrets', grants: ['catalog.products.view'] });

    // Act
    const failure = await failureOf(adminClient.query(TENANT_SECRETS));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });
});
