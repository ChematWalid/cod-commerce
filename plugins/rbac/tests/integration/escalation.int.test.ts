import { PERMISSION_AREA_IDS } from '@cod/shared';
import {
  type CredentialsFixture,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANCEL_ORDER, FORBIDDEN_STOCK_OPERATIONS } from './built-in-roles-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { allStoresRole, RoleApi, type RoleAnswer, RoleTeam } from './roles-kit';

const SNOWFLAKE_WORKER_ID = 1023;
const TEAM_FULL = { team: 'full', orders: 'view' } as const;

describe('role escalation (D60)', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let adminRole: RoleAnswer;
  let counter = 0;
  const unique = (label: string): string => {
    counter += 1;
    return `${label} ${String(counter)}`;
  };

  /** A role with the orders view keys, held by a throwaway member on these stores, so it has those bindings. */
  async function boundRole(stores?: Parameters<RoleTeam['assign']>[2]): Promise<RoleAnswer> {
    await team.asOwner();
    const role = await api.create(allStoresRole(unique('Bound'), { orders: 'view' }));
    const holder = await team.member();
    await team.assign(holder.id, [role.id], stores);
    return role;
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'esc');
    await team.asOwner();
    adminRole = await api.create(allStoresRole('Role admin', TEAM_FULL));
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  describe('a member limited to store A', () => {
    it('edits a role bound on store A (positive control)', async () => {
      const role = await boundRole([team.home]);
      await team.signedInMember([adminRole.id], [team.home]);

      const updated = await api.update(role.id, { name: unique('Mine') });

      expect(updated.id).toBe(role.id);
    });

    it('cannot edit a role bound on store B', async () => {
      const role = await boundRole([team.other]);
      await team.signedInMember([adminRole.id], [team.home]);

      expect((await failureOf(api.update(role.id, { name: unique('Nope') }))).codes).toEqual([
        'rbac.privilege-exceeded',
      ]);
    });

    it('cannot edit or delete an all-bound role', async () => {
      const role = await boundRole();
      await team.signedInMember([adminRole.id], [team.home]);

      expect((await failureOf(api.update(role.id, { name: unique('Nope') }))).codes).toEqual([
        'rbac.privilege-exceeded',
      ]);
      expect((await failureOf(api.remove(role.id))).codes).toEqual(['rbac.privilege-exceeded']);
    });

    it('with both stores and the permissions on each, can edit', async () => {
      const onBoth = await boundRole([team.home, team.other]);
      const onAll = await boundRole();
      await team.signedInMember([adminRole.id], [team.home, team.other]);

      expect((await api.update(onBoth.id, { name: unique('Both') })).id).toBe(onBoth.id);
      expect((await api.update(onAll.id, { name: unique('All') })).id).toBe(onAll.id);
    });
  });

  describe('a member with team.roles permissions', () => {
    it('cannot create a role with a key it lacks', async () => {
      await team.signedInMember([adminRole.id], undefined);

      const failure = await failureOf(api.create({ name: unique('Over'), grants: ['orders.cancel'] }));

      expect(failure.codes).toEqual(['rbac.privilege-exceeded']);
    });

    it('can create a role within what it holds (positive control)', async () => {
      await team.signedInMember([adminRole.id], undefined);

      const role = await api.create(allStoresRole(unique('Within'), { orders: 'view' }));

      expect(role.permissions.length).toBeGreaterThan(0);
    });

    it('cannot duplicate a role holding more than it has', async () => {
      const manager = await team.rows.roleId(businesses.a.businessId, 'manager');
      await team.signedInMember([adminRole.id], undefined);

      expect((await failureOf(api.duplicate(manager))).codes).toEqual(['rbac.privilege-exceeded']);
    });

    it('cannot edit or delete a role holding more than it has', async () => {
      await team.asOwner();
      const role = await api.create(allStoresRole(unique('Bigger'), { orders: 'full' }));
      await team.signedInMember([adminRole.id], undefined);

      expect((await failureOf(api.update(role.id, { name: unique('X') }))).codes).toEqual(['rbac.privilege-exceeded']);
      expect((await failureOf(api.remove(role.id))).codes).toEqual(['rbac.privilege-exceeded']);
    });

    it('cannot raise a role beyond what it holds', async () => {
      await team.asOwner();
      const role = await api.create(allStoresRole(unique('Small'), { orders: 'view' }));
      await team.signedInMember([adminRole.id], undefined);

      expect((await failureOf(api.update(role.id, { grants: ['orders.cancel'] }))).codes).toEqual([
        'rbac.privilege-exceeded',
      ]);
    });

    it('cannot edit a role it holds', async () => {
      await team.signedInMember([adminRole.id], undefined);

      expect((await failureOf(api.update(adminRole.id, { name: unique('Self') }))).codes).toEqual([
        'rbac.self-held-role',
      ]);
    });

    it('lets an owner holder edit a custom role it holds', async () => {
      await team.asOwner();
      const role = await api.create(allStoresRole(unique('Owner holds'), { orders: 'view' }));
      const owner = await team.rows.roleId(businesses.a.businessId, 'owner');
      await team.signedInMember([owner, role.id], undefined);

      expect((await api.update(role.id, { name: unique('Fine') })).id).toBe(role.id);
    });
  });

  describe('stock operations (D59)', () => {
    let member: { credentials: CredentialsFixture };

    beforeAll(async () => {
      await team.asOwner();
      const areas = Object.fromEntries(PERMISSION_AREA_IDS.map((area) => [area, 'full']));
      const everything = await api.create(allStoresRole(unique('All areas'), areas));
      member = await team.signedInMember([everything.id], undefined);
    });

    it('holds a catalog permission (positive control)', async () => {
      await actAsInNewSession(adminClient, member.credentials, team.home);

      await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });
    });

    it.each(Object.entries(FORBIDDEN_STOCK_OPERATIONS))(
      'refuses %s to a member with every area',
      async (_name, document) => {
        await actAsInNewSession(adminClient, member.credentials, team.home);

        const failure = await failureOf(adminClient.query(gql(document)));

        expect(failure.codes).toEqual(['FORBIDDEN']);
      },
    );
  });
});
