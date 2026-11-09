import { ACTIVITY_ACTIONS } from '@cod/shared';
import {
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANCEL_ORDER } from './built-in-roles-kit';
import { type AccessAnswer, type AccessInput, AccessRows, MEMBER_ACCESS, SET_ACCESS } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1017;

describe('setMemberAccess', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let rows: AccessRows;
  let managerRole: string;
  let ownerRole: string;
  let orderManagerRole: string;
  let storeOne: string;
  let storeTwo: string;
  let counter = 0;

  const member = async (): Promise<{ credentials: CredentialsFixture; id: string }> => {
    counter += 1;
    const credentials = await createMember(server.app, adminClient, {
      code: `access-${String(counter)}`,
      business: businesses.a,
      store: businesses.a.stores[0],
      permissions: ['Authenticated'],
    });
    return { credentials, id: await rows.administratorId(credentials) };
  };

  const set = (input: AccessInput): Promise<AccessAnswer> => adminClient.query<AccessAnswer>(SET_ACCESS, { input });
  const asOwner = (): Promise<string> => actAsInNewSession(adminClient, businesses.a.owner, businesses.a.stores[0]);
  const codeOf = async (input: AccessInput): Promise<readonly string[]> => (await failureOf(set(input))).codes;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    rows = new AccessRows(server.app);
    managerRole = await rows.roleId(businesses.a.businessId, 'manager');
    ownerRole = await rows.roleId(businesses.a.businessId, 'owner');
    orderManagerRole = await rows.roleId(businesses.a.businessId, 'order-manager');
    [storeOne, storeTwo] = businesses.a.stores.map((store) => store.id) as [string, string];
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('answers with the access it set, and memberAccess reads it back', async () => {
    // Arrange
    const { id } = await member();
    await asOwner();

    // Act
    const { setMemberAccess } = await set({
      administratorId: id,
      roleIds: [orderManagerRole],
      storeAccess: 'selected',
      storeIds: [storeOne],
    });
    const { memberAccess } = await adminClient.query<{ memberAccess: unknown }>(MEMBER_ACCESS, { administratorId: id });

    // Assert
    expect(setMemberAccess).toMatchObject({ administratorId: id, storeAccess: 'selected', storeIds: [storeOne] });
    expect(setMemberAccess.roles.map((role) => role.id)).toEqual([orderManagerRole]);
    expect(memberAccess).toEqual(setMemberAccess);
  });

  it('refuses a member without team.members.edit with FORBIDDEN', async () => {
    // Arrange
    const { credentials, id } = await member();
    await actAsInNewSession(adminClient, credentials, businesses.a.stores[0]);

    // Act
    const codes = await codeOf({ administratorId: id, roleIds: [], storeAccess: 'all' });

    // Assert
    expect(codes).toEqual(['FORBIDDEN']);
  });

  describe('selected bindings', () => {
    it('deletes the binding and its Vendure Role when the last holder leaves, and keeps it while another holds it', async () => {
      // Arrange
      const first = await member();
      const second = await member();
      await asOwner();
      const onStoreTwo: Omit<AccessInput, 'administratorId'> = {
        roleIds: [orderManagerRole],
        storeAccess: 'selected',
        storeIds: [storeTwo],
      };
      await set({ administratorId: first.id, ...onStoreTwo });
      await set({ administratorId: second.id, ...onStoreTwo });
      const binding = (await rows.bindings(orderManagerRole)).find((row) => row.scope === storeTwo);
      const leaveStoreTwo = { roleIds: [orderManagerRole], storeAccess: 'selected', storeIds: [storeOne] } as const;

      // Act
      await set({ administratorId: first.id, ...leaveStoreTwo });
      const whileHeld = (await rows.bindings(orderManagerRole)).some((row) => row.scope === storeTwo);
      const roleWhileHeld = await rows.vendureRoleExists(binding?.vendureRoleId ?? 0);
      await set({ administratorId: second.id, ...leaveStoreTwo });
      const afterLast = (await rows.bindings(orderManagerRole)).some((row) => row.scope === storeTwo);
      const roleAfterLast = await rows.vendureRoleExists(binding?.vendureRoleId ?? 0);

      // Assert
      expect(binding).toBeDefined();
      expect(whileHeld).toBe(true);
      expect(roleWhileHeld).toBe(true);
      expect(afterLast).toBe(false);
      expect(roleAfterLast).toBe(false);
    });
  });

  it('takes effect on the next request of a session already open', async () => {
    // Arrange
    const target = await member();
    await asOwner();
    await set({
      administratorId: target.id,
      roleIds: [orderManagerRole],
      storeAccess: 'selected',
      storeIds: [storeOne],
    });
    const memberToken = await actAsInNewSession(adminClient, target.credentials, businesses.a.stores[0]);
    await adminClient.query(CANCEL_ORDER);
    await asOwner();
    await set({ administratorId: target.id, roleIds: [], storeAccess: 'all' });

    // Act
    adminClient.setAuthToken(memberToken);
    adminClient.setChannelToken(businesses.a.stores[0].channelToken);
    const failure = await failureOf(adminClient.query(CANCEL_ORDER));

    // Assert
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  describe('refusals', () => {
    it("refuses changing one's own access", async () => {
      // Arrange
      await asOwner();
      const owner = await rows.administratorId(businesses.a.owner);

      // Act
      const codes = await codeOf({ administratorId: owner, roleIds: [ownerRole], storeAccess: 'all' });

      // Assert
      expect(codes).toEqual(['rbac.self-assignment']);
    });

    it('refuses a non-holder granting Owner', async () => {
      // Arrange
      const manager = await member();
      const target = await member();
      await asOwner();
      await set({ administratorId: manager.id, roleIds: [managerRole], storeAccess: 'all' });
      await actAsInNewSession(adminClient, manager.credentials, businesses.a.stores[0]);

      // Act
      const codes = await codeOf({ administratorId: target.id, roleIds: [ownerRole], storeAccess: 'all' });

      // Assert
      expect(codes).toEqual(['rbac.owner-restricted']);
    });

    it('refuses demoting the owner, even by another holder', async () => {
      // Arrange
      const holder = await member();
      await asOwner();
      await set({ administratorId: holder.id, roleIds: [ownerRole], storeAccess: 'all' });
      const owner = await rows.administratorId(businesses.a.owner);
      await actAsInNewSession(adminClient, holder.credentials, businesses.a.stores[0]);

      // Act
      const removed = await codeOf({ administratorId: owner, roleIds: [managerRole], storeAccess: 'all' });
      const narrowed = await codeOf({
        administratorId: owner,
        roleIds: [ownerRole],
        storeAccess: 'selected',
        storeIds: [storeOne],
      });

      // Assert
      expect(removed).toEqual(['rbac.last-owner']);
      expect(narrowed).toEqual(['rbac.last-owner']);
    });

    it.each([
      ['selected with no store', 'rbac.store-access-invalid', () => []],
      ['a store of B', 'rbac.store-not-accessible', () => [businesses.b.stores[0].id]],
    ])('refuses %s', async (_name, code, storeIds) => {
      // Arrange
      const { id } = await member();
      await asOwner();

      // Act
      const codes = await codeOf({
        administratorId: id,
        roleIds: [orderManagerRole],
        storeAccess: 'selected',
        storeIds: storeIds(),
      });

      // Assert
      expect(codes).toEqual([code]);
    });

    it('refuses a role of another business as not found', async () => {
      // Arrange
      const { id } = await member();
      const roleOfB = await rows.roleId(businesses.b.businessId, 'manager');
      await asOwner();

      // Act
      const codes = await codeOf({ administratorId: id, roleIds: [roleOfB], storeAccess: 'all' });

      // Assert
      expect(codes).toEqual(['rbac.role-not-found']);
    });

    it('treats unusable and foreign administrator ids as not found', async () => {
      // Arrange
      const ofB = await rows.administratorId(businesses.b.owner);
      await asOwner();

      // Act
      const results = await Promise.all(
        ['abc', '1e3', '2147483648', ofB].map(async (administratorId) => ({
          codes: await codeOf({ administratorId, roleIds: [], storeAccess: 'all' }),
          read: await adminClient.query<{ memberAccess: unknown }>(MEMBER_ACCESS, { administratorId }),
        })),
      );

      // Assert
      expect(results.map((result) => result.codes)).toEqual(Array.from({ length: 4 }, () => ['rbac.member-not-found']));
      expect(results.map((result) => result.read.memberAccess)).toEqual([null, null, null, null]);
    });
  });

  describe('concurrent demotions', () => {
    it('lets at most one of two holders remove the other', async () => {
      // Arrange
      const left = await member();
      const right = await member();
      await asOwner();
      await set({ administratorId: left.id, roleIds: [ownerRole], storeAccess: 'all' });
      await set({ administratorId: right.id, roleIds: [ownerRole], storeAccess: 'all' });
      const leftToken = await actAsInNewSession(adminClient, left.credentials, businesses.a.stores[0]);
      const rightToken = await actAsInNewSession(adminClient, right.credentials, businesses.a.stores[0]);
      const demote = (administratorId: string, token: string): Promise<unknown> => {
        adminClient.setAuthToken(token);
        return set({ administratorId, roleIds: [], storeAccess: 'all' });
      };

      // Act
      const outcomes = await Promise.allSettled([demote(right.id, leftToken), demote(left.id, rightToken)]);

      // Assert
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    });
  });

  describe('the activity log', () => {
    it('keeps a row with the role and store diff for a change, and none for no change', async () => {
      // Arrange
      const { id } = await member();
      await asOwner();
      const input = {
        administratorId: id,
        roleIds: [orderManagerRole],
        storeAccess: 'selected',
        storeIds: [storeOne],
      } as const;

      // Act
      await set(input);
      await set(input);
      const logged = await rows.activity(businesses.a.businessId, id);

      // Assert
      expect(logged).toHaveLength(1);
      expect(logged[0]?.action).toBe(ACTIVITY_ACTIONS.MEMBER_ACCESS_CHANGED);
      expect(logged[0]?.diff).toEqual({
        before: { roleIds: [], storeAccess: null, storeIds: [] },
        after: { roleIds: [orderManagerRole], storeAccess: 'selected', storeIds: [storeOne] },
      });
    });
  });
});
