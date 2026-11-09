import { PERMISSION_AREA_IDS } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { Permission, TransactionalConnection } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_LOG } from '../../application/tokens';
import { ENGINE_GRANTS } from '../../domain/engine-grants';
import type { ActivityLogPort } from '../../domain/ports/activity-log.port';
import { CANCEL_ORDER } from './built-in-roles-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { allStoresRole, RoleApi, type RoleAnswer, RoleTeam } from './roles-kit';

const SNOWFLAKE_WORKER_ID = 1020;
const ORDERS_VIEW_KEYS = 3;

describe('custom roles', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const api = new RoleApi(adminClient);
  let businesses: TwoBusinesses;
  let team: RoleTeam;
  let counter = 0;
  const unique = (label: string): string => {
    counter += 1;
    return `${label} ${String(counter)}`;
  };
  const customRole = (): Promise<RoleAnswer> => api.create(allStoresRole(unique('Role'), { orders: 'full' }));

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    team = new RoleTeam(server.app, adminClient, businesses, 'roles');
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('building the permissions', () => {
    it('copies a template when started from it', async () => {
      await team.asOwner();
      const tracker = await team.rows.roleId(businesses.a.businessId, 'order-tracker');

      const role = await api.create({ name: unique('From tracker'), startFromRoleId: tracker });

      expect(role.permissions).toEqual(await team.storedPermissions(tracker));
      expect(role.isBuiltIn).toBe(false);
    });

    it('grants only the three view keys for Orders at View', async () => {
      await team.asOwner();

      const role = await api.create(allStoresRole(unique('Viewer'), { orders: 'view' }));

      expect(role.permissions).toHaveLength(ORDERS_VIEW_KEYS);
      expect(role.permissions.every((key) => key.startsWith('orders.'))).toBe(true);
      expect(role.areaLevels.find(({ area }) => area === 'orders')?.level).toBe('view');
      expect(role.permissionCount).toBe(ORDERS_VIEW_KEYS);
    });

    it('lets a toggle override a level', async () => {
      await team.asOwner();

      const role = await api.create({
        ...allStoresRole(unique('Toggled'), { orders: 'view' }),
        grants: ['orders.cancel'],
        revokes: ['orders.view-all', 'orders.view'],
      });

      expect(role.permissions).toContain('orders.cancel');
      expect(role.permissions).not.toContain('orders.view');
      expect(role.areaLevels).toHaveLength(PERMISSION_AREA_IDS.length);
      expect(role.areaLevels.find(({ area }) => area === 'orders')?.level).toBe('custom');
    });

    it('keeps the permissions exactly on a name-only update', async () => {
      await team.asOwner();
      const role = await customRole();

      const updated = await api.update(role.id, { name: unique('Renamed') });

      expect(updated.permissions).toEqual(role.permissions);
      expect(updated.name).not.toBe(role.name);
    });

    it('replaces the permissions when startFromRoleId is sent on update', async () => {
      await team.asOwner();
      const role = await customRole();
      const tracker = await team.rows.roleId(businesses.a.businessId, 'order-tracker');

      const updated = await api.update(role.id, { startFromRoleId: tracker });

      expect(updated.permissions).toEqual(await team.storedPermissions(tracker));
    });

    it.each(['orders.not-a-key', 'UpdateAdministrator'])('refuses %s in grants', async (key) => {
      await team.asOwner();

      const failure = await failureOf(api.create({ name: unique('Bad'), grants: [key] }));

      expect(failure.codes).toEqual(['rbac.unknown-permission']);
    });

    it('refuses an area outside the catalog', async () => {
      await team.asOwner();

      const failure = await failureOf(api.create(allStoresRole(unique('Bad'), { nowhere: 'full' })));

      expect(failure.codes).toEqual(['rbac.unknown-permission']);
    });

    it('refuses a description over the limit', async () => {
      await team.asOwner();

      const failure = await failureOf(api.create({ name: unique('Long'), description: 'x'.repeat(256) }));

      expect(failure.codes).toEqual(['rbac.description-too-long']);
    });
  });

  describe('what Vendure holds', () => {
    it('projects no stock permission beyond Authenticated', async () => {
      await team.asOwner();
      const role = await api.create(
        allStoresRole(unique('Everything'), Object.fromEntries(PERMISSION_AREA_IDS.map((area) => [area, 'full']))),
      );
      const member = await team.member();

      await team.assign(member.id, [role.id]);

      const [binding] = await team.rows.bindings(role.id);
      const permissions = await rolePermissions(binding?.vendureRoleId ?? 0);
      const stock = Object.values(Permission) as string[];
      const engineGrants = Object.values(ENGINE_GRANTS).flat();
      expect(permissions.filter((name) => stock.includes(name))).toEqual([Permission.Authenticated]);
      expect(permissions.filter((name) => !name.startsWith('Cod') && name !== 'Authenticated').sort()).toEqual(
        [...engineGrants].sort(),
      );
    });

    async function rolePermissions(id: number): Promise<readonly string[]> {
      const roles = server.app
        .get(TransactionalConnection)
        .rawConnection.getRepository<{ permissions: string[] }>('Role');
      return (await roles.findOneByOrFail({ id } as never)).permissions;
    }

    it('updates every binding, so a member on two stores loses the key on both', async () => {
      await team.asOwner();
      const role = await customRole();
      const member = await team.signedInMember([role.id], [team.home, team.other]);
      await expect(adminClient.query(CANCEL_ORDER)).resolves.toBeDefined();

      await team.asOwner();
      await api.update(role.id, { revokes: ['orders.cancel'] });

      await actAs(adminClient, member.credentials, team.home);
      expect((await failureOf(adminClient.query(CANCEL_ORDER))).codes).toEqual(['FORBIDDEN']);
      await actAs(adminClient, member.credentials, team.other);
      expect((await failureOf(adminClient.query(CANCEL_ORDER))).codes).toEqual(['FORBIDDEN']);
    });

    it('accepts Full Orders and refuses a role without orders.cancel', async () => {
      await team.asOwner();
      const full = await customRole();
      const without = await api.create({
        ...allStoresRole(unique('No cancel'), { orders: 'full' }),
        revokes: ['orders.cancel'],
      });

      await team.signedInMember([full.id], undefined);
      await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });

      await team.signedInMember([without.id], undefined);
      expect((await failureOf(adminClient.query(CANCEL_ORDER))).codes).toEqual(['FORBIDDEN']);
    });
  });

  describe('built-ins and deletion', () => {
    it.each(['update', 'delete'] as const)('refuses to %s a built-in', async (action) => {
      await team.asOwner();
      const manager = await team.rows.roleId(businesses.a.businessId, 'manager');

      const failure = await failureOf(
        action === 'update' ? api.update(manager, { name: unique('Boss') }) : api.remove(manager),
      );

      expect(failure.codes).toEqual(['rbac.built-in-immutable']);
    });

    it('refuses to delete a role in use', async () => {
      await team.asOwner();
      const role = await customRole();
      const member = await team.member();
      await team.assign(member.id, [role.id]);

      const failure = await failureOf(api.remove(role.id));

      expect(failure.codes).toEqual(['rbac.role-in-use']);
    });

    it('leaves no binding and no Vendure Role behind an unassigned role', async () => {
      await team.asOwner();
      const role = await customRole();
      const member = await team.member();
      const tracker = await team.rows.roleId(businesses.a.businessId, 'order-tracker');
      await team.assign(member.id, [role.id]);
      await team.assign(member.id, [tracker]);
      const bindings = await team.rows.bindings(role.id);
      expect(bindings).toHaveLength(1);

      await api.remove(role.id);

      expect(await team.rows.bindings(role.id)).toEqual([]);
      expect(await team.rows.vendureRoleExists(bindings[0]?.vendureRoleId ?? 0)).toBe(false);
      expect(await api.get(role.id)).toBeNull();
    });
  });

  describe('activity', () => {
    it('writes one row each for create, update and delete with actor, address and diff', async () => {
      await team.asOwner();
      const ownerId = await team.rows.administratorId(businesses.a.owner);

      const role = await api.create(allStoresRole(unique('Logged'), { tracking: 'view' }));
      await api.update(role.id, { grants: ['orders.cancel'], revokes: [role.permissions[0] as string] });
      await api.remove(role.id);

      const rows = await team.rows.activity(businesses.a.businessId, role.id);
      expect(rows.map(({ action }) => action).sort()).toEqual([
        'rbac.role.created',
        'rbac.role.deleted',
        'rbac.role.updated',
      ]);
      for (const row of rows) {
        expect(String(row.actorAdministratorId)).toBe(ownerId);
        expect(row.ip).toEqual(expect.any(String));
      }
      const updated = rows.find(({ action }) => action === 'rbac.role.updated');
      expect(updated?.diff['permissions']).toEqual({ added: ['orders.cancel'], removed: [role.permissions[0]] });
    });

    it.each(['create', 'update', 'delete'] as const)(
      'undoes the %s when the activity row cannot be written',
      async (kind) => {
        await team.asOwner();
        const role = await customRole();
        const name = unique('Rolled');
        vi.spyOn(server.app.get<ActivityLogPort>(ACTIVITY_LOG), 'append').mockRejectedValueOnce(
          new Error('append failed'),
        );

        if (kind === 'create') await expect(api.create({ name })).rejects.toBeDefined();
        if (kind === 'update')
          await expect(api.update(role.id, { name, revokes: ['orders.cancel'] })).rejects.toBeDefined();
        if (kind === 'delete') await expect(api.remove(role.id)).rejects.toBeDefined();

        const after = await api.get(role.id);
        expect(after?.name).toBe(role.name);
        expect(after?.permissions).toEqual(role.permissions);
        expect((await api.list()).some((row) => row.name === name)).toBe(false);
      },
    );
  });
});
