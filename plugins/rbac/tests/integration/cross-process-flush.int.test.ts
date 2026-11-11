import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { CacheService, ConfigService, DefaultSessionCacheStrategy, RedisCacheStrategy } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANCEL_ORDER } from './built-in-roles-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment, TEST_REDIS_URL } from './rbac-test-environment';
import { allStoresRole, RoleApi, RoleTeam } from './roles-kit';
import { settleSessionFlushes } from './session-kit';

const SERVER_A_WORKER_ID = 1000;
const SERVER_B_WORKER_ID = 1001;
/** Server A listens on `testConfig`'s 3050. */
const SERVER_B_PORT = 3051;
// Unique per file and run: another file or run sharing this Valkey never reads these sessions.
const SHARED_CACHE = { redisUrl: TEST_REDIS_URL, namespace: `cod-test:cross-process-flush:${String(process.pid)}` };

const DELETE_ADMINISTRATOR = gql`
  mutation ($id: ID!) {
    deleteAdministrator(id: $id) {
      result
    }
  }
`;

type Environment = ReturnType<typeof createRbacTestEnvironment>;

/**
 * Two servers on one Postgres and one Valkey stand in for two server processes (#211, CO-10): a change made
 * through A must end a session that B serves from the shared cache.
 */
describe('a session flush across server processes', () => {
  const a = createRbacTestEnvironment(SERVER_A_WORKER_ID, { sharedCache: SHARED_CACHE });
  let b: Environment;
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let counter = 0;

  const configOf = (environment: Environment): ConfigService => environment.server.app.get(ConfigService);

  /** A member of business A holding a fresh role with every orders permission, signed in on server B. */
  async function memberSignedInOnB(): Promise<{ roleId: string; administratorId: string; token: string }> {
    counter += 1;
    await team.asOwner();
    const role = await new RoleApi(a.adminClient).create(
      allStoresRole(`Cross-process role ${String(counter)}`, { orders: 'full' }),
    );
    const member = await team.member();
    await team.assign(member.id, [role.id]);
    const token = await actAsInNewSession(b.adminClient, member.credentials, team.home);
    return { roleId: role.id, administratorId: member.id, token };
  }

  const cancelOnB = (token: string): ReturnType<SimpleGraphQLClient['query']> => {
    b.adminClient.setAuthToken(token);
    return b.adminClient.query(CANCEL_ORDER);
  };

  beforeAll(async () => {
    await a.server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(a.adminClient);
    team = new RoleTeam(a.server.app, a.adminClient, businesses, 'cross-process');
    // Booted after the businesses exist: Vendure keeps each process's channel list in memory.
    b = createRbacTestEnvironment(SERVER_B_WORKER_ID, {
      sharedCache: SHARED_CACHE,
      port: SERVER_B_PORT,
      attachToDatabase: String(configOf(a).dbConnectionOptions.database),
    });
    await b.server.init({ initialData: PLUGIN_TEST_INITIAL_DATA });
  }, 120_000);

  afterAll(async () => {
    // The delayed repeat deletes (D55) must not reach a closed Valkey client.
    await settleSessionFlushes();
    await b.server.destroy();
    await a.server.destroy();
  });

  it('runs two servers that keep sessions in one Valkey namespace, each through its own cache', async () => {
    // Arrange
    const key = `cross-process-probe-${String(process.pid)}`;
    const cacheA = a.server.app.get(CacheService);

    // Act
    await cacheA.set(key, 'written by A');
    const readByB = await b.server.app.get(CacheService).get<string>(key);
    await cacheA.delete(key);

    // Assert
    const sessionsA = configOf(a).authOptions.sessionCacheStrategy;
    const sessionsB = configOf(b).authOptions.sessionCacheStrategy;
    const storeA = configOf(a).systemOptions.cacheStrategy;
    const storeB = configOf(b).systemOptions.cacheStrategy;
    expect(sessionsA).toBeInstanceOf(DefaultSessionCacheStrategy);
    expect(sessionsB).toBeInstanceOf(DefaultSessionCacheStrategy);
    expect(sessionsA).not.toBe(sessionsB);
    expect(storeA).toBeInstanceOf(RedisCacheStrategy);
    expect(storeB).toBeInstanceOf(RedisCacheStrategy);
    expect(storeA).not.toBe(storeB);
    expect(readByB).toBe('written by A');
  });

  it('refuses on B the old token of a member whose role lost the permission through A', async () => {
    // Arrange
    const member = await memberSignedInOnB();
    await expect(cancelOnB(member.token)).resolves.toEqual({ rbacTestCancelOrder: true });
    await team.asOwner();

    // Act
    await new RoleApi(a.adminClient).update(member.roleId, { revokes: ['orders.cancel'] });

    // Assert
    expect((await failureOf(cancelOnB(member.token))).codes).toEqual(['FORBIDDEN']);
  });

  // A role edit also clears every cached session through Vendure's own Role subscriber; withdrawn access
  // reaches B only through RoleSessionFlusher (D55), so this case is the one that fails without it.
  it('refuses on B the old token of a member whose access was withdrawn through A', async () => {
    // Arrange
    const member = await memberSignedInOnB();
    await expect(cancelOnB(member.token)).resolves.toEqual({ rbacTestCancelOrder: true });

    // Act
    await team.assign(member.administratorId, []);

    // Assert
    expect((await failureOf(cancelOnB(member.token))).codes).toEqual(['FORBIDDEN']);
  });

  it('refuses on B the old token of an administrator removed through A', async () => {
    // Arrange
    const member = await memberSignedInOnB();
    await expect(cancelOnB(member.token)).resolves.toEqual({ rbacTestCancelOrder: true });
    await a.adminClient.asSuperAdmin();

    // Act
    await a.adminClient.query(DELETE_ADMINISTRATOR, { id: member.administratorId });

    // Assert
    expect((await failureOf(cancelOnB(member.token))).codes).toEqual(['FORBIDDEN']);
  });
});
