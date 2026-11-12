import { AuthPlugin } from '@cod/plugin-auth';
import { RbacPlugin, SESSION_FLUSH_SETTLE_MS } from '@cod/plugin-rbac';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { ConfigService } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authTestOptions, createTeamTestEnvironment, TEST_REDIS_URL, TeamKit } from './team-kit';

const SERVER_A_WORKER_ID = 1018;
const SERVER_B_WORKER_ID = 1019;
/** Server A listens on `testConfig`'s 3050. */
const SERVER_B_PORT = 3051;
// Unique per file and run: another file or run sharing this Valkey never reads these sessions.
const SHARED_CACHE = { redisUrl: TEST_REDIS_URL, namespace: `cod-test:team-member-removal:${String(process.pid)}` };
const BUSINESS_ROLES = gql`
  query {
    businessRoles {
      id
      memberCount
    }
  }
`;

const foreignPlugins = () => [RbacPlugin, AuthPlugin.init(authTestOptions())];
type Environment = ReturnType<typeof createTeamTestEnvironment>;

/**
 * A removal made through server A must end the member's session that server B serves from the shared Valkey cache:
 * two servers on one Postgres stand in for two server processes (P1.S4 Task 4 harness, D204).
 */
describe('removing a member, seen from a second server process', () => {
  const a = createTeamTestEnvironment(SERVER_A_WORKER_ID, foreignPlugins(), { sharedCache: SHARED_CACHE });
  let b: Environment | undefined;
  let businesses: TwoBusinesses;
  let kitA: TeamKit;
  let kitB: TeamKit;

  const serverB = (): Environment => {
    if (!b) throw new Error('Server B did not boot; see the beforeAll error.');
    return b;
  };

  /** The members holding the business's Owner role, as rbac counts them for A's owner. */
  async function ownerHolders(): Promise<number | undefined> {
    const ownerRole = await kitA.builtInRoleId(businesses.a, 'owner');
    await kitA.newSession(businesses.a.owner, businesses.a.stores[0]);
    const { businessRoles } = await a.adminClient.query<{ businessRoles: { id: string; memberCount: number }[] }>(
      BUSINESS_ROLES,
    );
    return businessRoles.find((role) => role.id === ownerRole)?.memberCount;
  }

  beforeAll(async () => {
    await a.server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(a.adminClient);
    kitA = new TeamKit(a.server.app, a.adminClient);
    // Booted after the businesses exist: Vendure keeps each process's channel list in memory.
    b = createTeamTestEnvironment(SERVER_B_WORKER_ID, foreignPlugins(), {
      sharedCache: SHARED_CACHE,
      port: SERVER_B_PORT,
      attachToDatabase: String(a.server.app.get(ConfigService).dbConnectionOptions.database),
    });
    await serverB().server.init({ initialData: PLUGIN_TEST_INITIAL_DATA });
    kitB = new TeamKit(serverB().server.app, serverB().adminClient);
  }, 120_000);

  afterAll(async () => {
    // The delayed repeat deletes (D55) must not reach a closed Valkey client; each server is torn down on its own.
    try {
      await new Promise((resolve) => setTimeout(resolve, SESSION_FLUSH_SETTLE_MS));
      await b?.server.destroy();
    } finally {
      await a.server.destroy();
    }
  });

  it('refuses on B the old token of a member removed through A, and the Owner role stops counting it', async () => {
    // Arrange
    const { a: business } = businesses;
    const coOwner = await kitA.teamMemberWith(business, await kitA.builtInRoleId(business, 'owner'));
    const holdersBefore = await ownerHolders();
    const token = await kitB.newSession(coOwner, business.stores[0]);
    const beforeRemoval = await kitB.rest('GET', '/employees');
    await kitA.newSession(business.owner, business.stores[0]);

    // Act
    const removed = await kitA.rest('DELETE', `/employees/${coOwner.memberId}`);
    kitB.useSession(token, business.stores[0]);
    const afterRemoval = await kitB.rest('GET', '/employees');

    // Assert
    expect([beforeRemoval.status, removed.status, afterRemoval.status]).toEqual([200, 200, 403]);
    expect(await ownerHolders()).toBe((holdersBefore ?? 0) - 1);
  });
});
