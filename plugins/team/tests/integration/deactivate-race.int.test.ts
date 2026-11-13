import { AuthPlugin } from '@cod/plugin-auth';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { createTwoBusinesses, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RbacMemberAccessAdapter } from '../../infrastructure/rbac-member-access.adapter';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';
import { MEMBER_ACCESS, SET_MEMBER_ACCESS } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1024;
const { server, adminClient } = createTeamTestEnvironment(SNOWFLAKE_WORKER_ID, {
  plugins: [RbacPlugin, AuthPlugin.init(authTestOptions())],
  partitionedSchemas: [ACTIVITY_LOG_SCHEMA],
});

let businesses: TwoBusinesses;
let kit: TeamKit;

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  businesses = await createTwoBusinesses(adminClient);
  kit = new TeamKit(server.app, adminClient);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.destroy();
});

/** The roles rbac holds for the administrator, as A's owner reads them. */
async function rolesOf(administratorId: number): Promise<string[]> {
  const { memberAccess } = await adminClient.query<{ memberAccess: { roles: { id: string }[] } }>(MEMBER_ACCESS, {
    administratorId: String(administratorId),
  });
  return memberAccess.roles.map(({ id }) => id);
}

/**
 * Runs rbac's own `setMemberAccess` to completion right after Team has read the member's access for its deactivate,
 * and before Team takes rbac's lock: the interleaving of D804, made deterministic.
 */
function setAccessDuringTeamRead(administratorId: number, roleIds: readonly string[]): void {
  const read = RbacMemberAccessAdapter.prototype.accessOf;
  let fired = false;
  vi.spyOn(RbacMemberAccessAdapter.prototype, 'accessOf').mockImplementation(async function (
    this: RbacMemberAccessAdapter,
    ...args: Parameters<RbacMemberAccessAdapter['accessOf']>
  ) {
    const seen = await read.apply(this, args);
    if (!fired && args[2] === administratorId) {
      fired = true;
      await adminClient.query(SET_MEMBER_ACCESS, {
        input: { administratorId: String(administratorId), roleIds, storeAccess: 'all' },
      });
    }
    return seen;
  });
}

describe('deactivating a member while rbac changes its access (D804)', () => {
  it('leaves no role on the deactivated member and reactivates it with the access it last held', async () => {
    // Arrange
    const { a } = businesses;
    const before = await kit.customRole(a, ['team.members.view']);
    const latest = await kit.customRole(a, ['orders.view']);
    const member = await kit.teamMemberWith(a, before);
    await kit.newSession(a.owner, a.stores[0]);
    setAccessDuringTeamRead(member.administratorId, [latest]);

    // Act
    const deactivated = await kit.rest('POST', `/employees/${member.memberId}/deactivate`);
    vi.restoreAllMocks();
    const whileInactive = await rolesOf(member.administratorId);
    const reactivated = await kit.rest('POST', `/employees/${member.memberId}/reactivate`);

    // Assert
    expect(deactivated).toMatchObject({ status: 200, body: { status: 'inactive' } });
    expect(whileInactive).toEqual([]);
    expect(reactivated).toMatchObject({ status: 200, body: { status: 'active' } });
    expect(await rolesOf(member.administratorId)).toEqual([latest]);
  });
});
