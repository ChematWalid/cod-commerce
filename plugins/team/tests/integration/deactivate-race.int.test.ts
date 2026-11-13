import { AuthPlugin } from '@cod/plugin-auth';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RbacMemberAccessAdapter } from '../../infrastructure/rbac-member-access.adapter';
import { authTestOptions, createTeamTestEnvironment, TeamKit } from './team-kit';
import { SET_MEMBER_ACCESS } from './team-operations';

const SNOWFLAKE_WORKER_ID = 1024;
/** How long Team waits for rbac's concurrent call before going on; it finishes at once unless rbac's lock holds it. */
const CONCURRENT_GRACE_MS = 1_500;
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

/** The roles rbac holds for the administrator, read from its rows. */
async function rolesOf(administratorId: number): Promise<string[]> {
  const rows = await kit.query<{ businessRoleId: string }>(
    'SELECT "businessRoleId" FROM member_role_assignment WHERE "administratorId" = $1 ORDER BY "businessRoleId"',
    [administratorId],
  );
  return rows.map((row) => row.businessRoleId);
}

/** Gives the administrator exactly `roleIds` on all stores, as A's owner, through rbac's own mutation. */
const setMemberAccess = (administratorId: number, roleIds: readonly string[]) =>
  adminClient.query(SET_MEMBER_ACCESS, {
    input: { administratorId: String(administratorId), roleIds, storeAccess: 'all' },
  });

/**
 * Starts rbac's own `setMemberAccess` while Team reads the member's access for its action, and lets Team go on once
 * that call ends or after {@link CONCURRENT_GRACE_MS}. Without rbac's lock held by Team the call commits inside Team's
 * read; with it (D804) it waits for Team to commit. Returns the call's outcome: its error codes, `[]` on success.
 */
function setAccessDuringTeamRead(administratorId: number, roleIds: readonly string[]): Promise<readonly string[]> {
  type AccessOf = (
    this: RbacMemberAccessAdapter,
    ...args: Parameters<RbacMemberAccessAdapter['accessOf']>
  ) => ReturnType<RbacMemberAccessAdapter['accessOf']>;
  const read = Object.getOwnPropertyDescriptor(RbacMemberAccessAdapter.prototype, 'accessOf')?.value as AccessOf;
  let outcome: Promise<readonly string[]> | undefined;
  vi.spyOn(RbacMemberAccessAdapter.prototype, 'accessOf').mockImplementation(async function (
    this: RbacMemberAccessAdapter,
    ...args: Parameters<RbacMemberAccessAdapter['accessOf']>
  ) {
    const seen = await read.apply(this, args);
    if (outcome === undefined && args[2] === administratorId) {
      outcome = failureOf(setMemberAccess(administratorId, roleIds)).then(
        (failure) => failure.codes,
        (): readonly string[] => [],
      );
      await Promise.race([outcome, new Promise((resolve) => setTimeout(resolve, CONCURRENT_GRACE_MS))]);
    }
    return seen;
  });
  return new Promise((resolve) => {
    const wait = setInterval(() => {
      if (outcome === undefined) return;
      clearInterval(wait);
      resolve(outcome);
    }, 50);
  });
}

/** An active member of A holding `roleId`, or no role at all when `keepRole` is false; the owner is signed in. */
async function memberOfA(roleId: string, keepRole: boolean) {
  const member = await kit.teamMemberWith(businesses.a, roleId);
  await kit.newSession(businesses.a.owner, businesses.a.stores[0]);
  if (!keepRole) await setMemberAccess(member.administratorId, []);
  return member;
}

describe('a Team action while rbac changes the same member (D804)', () => {
  it('refuses the concurrent grant to a member being deactivated, and reactivates it with the access it had', async () => {
    // Arrange
    const before = await kit.customRole(businesses.a, ['team.members.view']);
    const latest = await kit.customRole(businesses.a, ['orders.view']);
    const member = await memberOfA(before, true);
    const concurrent = setAccessDuringTeamRead(member.administratorId, [latest]);

    // Act
    const deactivated = await kit.rest('POST', `/employees/${member.memberId}/deactivate`);
    const concurrentCodes = await concurrent;
    vi.restoreAllMocks();
    const whileInactive = await rolesOf(member.administratorId);
    const reactivated = await kit.rest('POST', `/employees/${member.memberId}/reactivate`);

    // Assert
    expect(deactivated).toMatchObject({ status: 200, body: { status: 'inactive' } });
    expect(concurrentCodes).toEqual(['rbac.member-suspended']);
    expect(whileInactive).toEqual([]);
    expect(reactivated).toMatchObject({ status: 200, body: { status: 'active' } });
    expect(await rolesOf(member.administratorId)).toEqual([before]);
  });

  it('leaves no role on a member read as roleless while rbac grants it one, on deactivate', async () => {
    // Arrange
    const latest = await kit.customRole(businesses.a, ['orders.view']);
    const member = await memberOfA(await kit.customRole(businesses.a, ['team.members.view']), false);
    const concurrent = setAccessDuringTeamRead(member.administratorId, [latest]);

    // Act
    const deactivated = await kit.rest('POST', `/employees/${member.memberId}/deactivate`);
    const concurrentCodes = await concurrent;

    // Assert
    expect(deactivated.status).toBe(200);
    expect(concurrentCodes).toEqual(['rbac.member-suspended']);
    expect(await rolesOf(member.administratorId)).toEqual([]);
  });

  it('leaves no role on a member read as roleless while rbac grants it one, on remove', async () => {
    // Arrange
    const latest = await kit.customRole(businesses.a, ['orders.view']);
    const member = await memberOfA(await kit.customRole(businesses.a, ['team.members.view']), false);
    const concurrent = setAccessDuringTeamRead(member.administratorId, [latest]);

    // Act
    const removed = await kit.rest('DELETE', `/employees/${member.memberId}`);
    const concurrentCodes = await concurrent;

    // Assert
    expect(removed.status).toBe(200);
    expect(concurrentCodes).not.toEqual([]);
    expect(await rolesOf(member.administratorId)).toEqual([]);
  });

  it('keeps a role rbac withdrew while a store-only edit was reading the member', async () => {
    // Arrange
    const kept = await kit.customRole(businesses.a, ['team.members.view']);
    const withdrawn = await kit.customRole(businesses.a, ['orders.view']);
    const member = await memberOfA(kept, true);
    await setMemberAccess(member.administratorId, [kept, withdrawn]);
    const concurrent = setAccessDuringTeamRead(member.administratorId, [kept]);

    // Act
    const edited = await kit.rest('PATCH', `/employees/${member.memberId}`, {
      storeAccess: 'selected',
      storeIds: [businesses.a.stores[1].id],
    });
    await concurrent;
    vi.restoreAllMocks();

    // Assert
    expect(edited.status).toBe(200);
    expect(await rolesOf(member.administratorId)).not.toContain(withdrawn);
  });
});
