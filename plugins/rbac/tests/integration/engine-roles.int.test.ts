import {
  type CredentialsFixture,
  createTwoBusinesses,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { Administrator, Channel, RequestContextService, Role, TransactionalConnection, User } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENGINE_ROLES } from '../../application/tokens';
import type { EngineRolesPort } from '../../domain/ports/engine-roles.port';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1015;

describe('VendureEngineRoles', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let engine: EngineRolesPort;
  let ctx: OperationContext;

  const connection = (): TransactionalConnection['rawConnection'] =>
    server.app.get(TransactionalConnection).rawConnection;
  const channelId = async (token: string): Promise<number> =>
    (await connection().getRepository(Channel).findOneByOrFail({ token })).id as number;
  const adminOf = ({ email }: CredentialsFixture): Promise<Administrator> =>
    connection().getRepository(Administrator).findOneByOrFail({ emailAddress: email });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    engine = server.app.get<EngineRolesPort>(ENGINE_ROLES);
    ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('creates a role on the named channels only, always holding Authenticated', async () => {
    const channel = await channelId(businesses.a.stores[0].channelToken);

    const roleId = await engine.createRole(ctx, {
      code: 'engine-create',
      permissions: ['CodOrdersView'],
      channelIds: [channel],
    });

    expect(await engine.permissionsOf(ctx, roleId)).toEqual(expect.arrayContaining(['Authenticated', 'CodOrdersView']));
    const role = await connection()
      .getRepository(Role)
      .findOneOrFail({ where: { id: roleId }, relations: { channels: true } });
    expect(role.channels.map((entry) => entry.id)).toEqual([channel]);
  });

  it('adds a channel without replacing the others', async () => {
    const first = await channelId(businesses.a.stores[0].channelToken);
    const second = await channelId(businesses.a.stores[1].channelToken);
    const roleId = await engine.createRole(ctx, { code: 'engine-add', permissions: [], channelIds: [first] });

    await engine.addChannel(ctx, roleId, second);

    const role = await connection()
      .getRepository(Role)
      .findOneOrFail({ where: { id: roleId }, relations: { channels: true } });
    expect(role.channels.map((entry) => entry.id).sort()).toEqual([first, second].sort());
  });

  it('replaces the permissions of a role', async () => {
    const roleId = await engine.createRole(ctx, {
      code: 'engine-update',
      permissions: ['CodOrdersView'],
      channelIds: [],
    });

    await engine.updatePermissions(ctx, roleId, ['CodOrdersCancel']);

    const permissions = await engine.permissionsOf(ctx, roleId);
    expect(permissions).toContain('CodOrdersCancel');
    expect(permissions).not.toContain('CodOrdersView');
  });

  it('replaces the roles of an administrator', async () => {
    const channel = await channelId(businesses.b.stores[0].channelToken);
    const roleId = await engine.createRole(ctx, { code: 'engine-assign', permissions: [], channelIds: [channel] });
    const administrator = await adminOf(businesses.b.owner);
    const user = await connection()
      .getRepository(User)
      .findOneOrFail({
        where: { identifier: businesses.b.owner.email },
        relations: { roles: true },
      });
    const originalRoleIds = user.roles.map((role) => role.id as number);

    await engine.setAdministratorRoles(ctx, administrator.id as number, [...originalRoleIds, roleId]);

    const after = await connection()
      .getRepository(User)
      .findOneOrFail({ where: { id: user.id }, relations: { roles: true } });
    expect(after.roles.map((role) => role.id).sort()).toEqual([...originalRoleIds, roleId].sort());
    await engine.setAdministratorRoles(ctx, administrator.id as number, originalRoleIds);
  });

  it('deletes a role', async () => {
    const roleId = await engine.createRole(ctx, { code: 'engine-delete', permissions: [], channelIds: [] });

    await engine.deleteRole(ctx, roleId);

    expect(await connection().getRepository(Role).countBy({ id: roleId })).toBe(0);
  });
});
