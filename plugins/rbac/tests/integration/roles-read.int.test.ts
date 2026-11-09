import { PERMISSION_AREA_IDS, PERMISSION_CATALOG } from '@cod/shared';
import { createTwoBusinesses, failureOf, PLUGIN_TEST_INITIAL_DATA, type TwoBusinesses } from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { actAs, actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import {
  allStoresRole,
  EFFECTIVE_PERMISSIONS,
  PERMISSION_CATALOG_QUERY,
  RoleApi,
  type RoleAnswer,
  RoleTeam,
} from './roles-kit';

const SNOWFLAKE_WORKER_ID = 999;

describe('role reads and refusals', () => {
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
    team = new RoleTeam(server.app, adminClient, businesses, 'reads');
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('answers the catalog with a label in every language', async () => {
    await team.asOwner();

    const { permissionCatalog } = await adminClient.query<{
      permissionCatalog: { areas: unknown[]; permissions: { key: string; label: { fr: string; en: string } }[] };
    }>(PERMISSION_CATALOG_QUERY);

    expect(permissionCatalog.areas).toHaveLength(PERMISSION_AREA_IDS.length);
    expect(permissionCatalog.permissions).toHaveLength(PERMISSION_CATALOG.length);
    expect(permissionCatalog.permissions.every(({ label }) => label.fr.length > 0)).toBe(true);
  });

  it('answers effective permissions for the active store from our rows', async () => {
    await team.asOwner();
    const role = await api.create(allStoresRole(unique('Effective'), { orders: 'view' }));
    await team.signedInMember([role.id], [team.home]);

    const { effectivePermissions } = await adminClient.query<{
      effectivePermissions: { storeId: string; permissions: string[]; storeAccess: string };
    }>(EFFECTIVE_PERMISSIONS);

    expect(effectivePermissions).toEqual({
      storeId: team.home.id,
      permissions: [...role.permissions],
      storeAccess: 'selected',
    });
  });

  it('counts members and lists built-ins', async () => {
    await team.asOwner();
    const role = await customRole();
    const member = await team.member();
    await team.assign(member.id, [role.id]);

    const roles = await api.list();

    expect(roles.find(({ id }) => id === role.id)?.memberCount).toBe(1);
    expect(roles.find(({ builtInKey }) => builtInKey === 'owner')?.memberCount).toBe(1);
  });

  it('refuses each operation without its permission', async () => {
    await team.asOwner();
    const role = await customRole();
    const member = await team.member();
    await actAsInNewSession(adminClient, member.credentials, team.home);

    const failures = await Promise.all([
      failureOf(api.list()),
      failureOf(api.get(role.id)),
      failureOf(api.create({ name: unique('No') })),
      failureOf(api.update(role.id, { name: unique('No') })),
      failureOf(api.remove(role.id)),
      failureOf(api.duplicate(role.id)),
    ]);

    expect(failures.flatMap(({ codes }) => codes)).toEqual(new Array(failures.length).fill('FORBIDDEN'));
  });

  it('treats another business as not found', async () => {
    await team.asOwner();
    const mine = await customRole();
    const [foreignStore] = businesses.b.stores;
    await actAs(adminClient, businesses.b.owner, foreignStore);

    expect(await api.get(mine.id)).toBeNull();
    const foreignRoles = await api.list();
    expect(foreignRoles.length).toBeGreaterThan(0);
    expect(foreignRoles.some(({ id }) => id === mine.id)).toBe(false);
    expect((await failureOf(api.update(mine.id, { name: unique('Took') }))).codes).toEqual(['rbac.role-not-found']);
    expect((await failureOf(api.remove(mine.id))).codes).toEqual(['rbac.role-not-found']);
    expect((await failureOf(api.duplicate(mine.id))).codes).toEqual(['rbac.role-not-found']);
    expect((await failureOf(api.create({ name: unique('X'), startFromRoleId: mine.id }))).codes).toEqual([
      'rbac.role-not-found',
    ]);
    const created = await api.create({ name: mine.name });
    expect(created.id).not.toBe(mine.id);
    expect(
      await server.app
        .get(TransactionalConnection)
        .rawConnection.getRepository(BusinessRoleEntity)
        .countBy({ name: mine.name }),
    ).toBe(2);
    await team.asOwner();
    expect(await api.get(mine.id)).toMatchObject({ name: mine.name, permissions: mine.permissions });
  });
});
