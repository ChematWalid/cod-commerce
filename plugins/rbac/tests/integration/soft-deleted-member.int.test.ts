import { toBusinessId, type TenantScope } from '@cod/shared';
import {
  type BusinessFixture,
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GetRolesService } from '../../application/get-roles.service';
import { MemberAccessService } from '../../application/member-access.service';
import { ACTOR_DIRECTORY } from '../../application/tokens';
import type { ActorDirectoryPort } from '../../domain/ports/actor-directory.port';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { type AccessInput, AccessRows, SET_ACCESS } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';
import { allStoresRole, RoleApi } from './roles-kit';

const SNOWFLAKE_WORKER_ID = 1002;

const DELETE_ADMINISTRATOR = gql`
  mutation ($id: ID!) {
    deleteAdministrator(id: $id) {
      result
    }
  }
`;

describe('a soft-deleted administrator', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;
  let rows: AccessRows;
  let ctx: OperationContext;
  let counter = 0;

  const scopeOf = (business: BusinessFixture): TenantScope => ({ businessId: toBusinessId(business.businessId) });
  const directory = (): ActorDirectoryPort => server.app.get<ActorDirectoryPort>(ACTOR_DIRECTORY);
  const roleId = (business: BusinessFixture, key: 'owner' | 'manager'): Promise<string> =>
    rows.roleId(business.businessId, key);

  const member = async (business: BusinessFixture): Promise<{ credentials: CredentialsFixture; id: string }> => {
    counter += 1;
    const credentials = await createMember(server.app, adminClient, {
      code: `soft-deleted-${String(counter)}`,
      business,
      store: business.stores[0],
      permissions: ['Authenticated'],
    });
    return { credentials, id: await rows.administratorId(credentials) };
  };

  const setAs = async (actor: CredentialsFixture, business: BusinessFixture, input: AccessInput): Promise<unknown> => {
    await actAsInNewSession(adminClient, actor, business.stores[0]);
    return adminClient.query(SET_ACCESS, { input });
  };

  /** Vendure's own delete, which soft-deletes the administrator and its user. */
  const softDelete = async (administratorId: string): Promise<void> => {
    await adminClient.asSuperAdmin();
    await adminClient.query(DELETE_ADMINISTRATOR, { id: administratorId });
  };

  const memberCount = async (business: BusinessFixture, id: string): Promise<number | undefined> =>
    (await server.app.get(GetRolesService).get(ctx, scopeOf(business), id))?.memberCount;

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    rows = new AccessRows(server.app);
    ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('is no member, holds no access and counts toward no role, while business B is untouched', async () => {
    // Arrange
    const { a, b } = businesses;
    const manager = await member(a);
    const twin = await member(b);
    await setAs(a.owner, a, { administratorId: manager.id, roleIds: [await roleId(a, 'manager')], storeAccess: 'all' });
    await setAs(b.owner, b, { administratorId: twin.id, roleIds: [await roleId(b, 'manager')], storeAccess: 'all' });
    const twinCountBefore = await memberCount(b, await roleId(b, 'manager'));

    // Act
    await softDelete(manager.id);

    // Assert
    expect(await directory().isMember(ctx, scopeOf(a), Number(manager.id))).toBe(false);
    expect(await server.app.get(MemberAccessService).getAccess(ctx, scopeOf(a), Number(manager.id))).toBeUndefined();
    expect(await memberCount(a, await roleId(a, 'manager'))).toBe(0);
    expect(await directory().isMember(ctx, scopeOf(b), Number(twin.id))).toBe(true);
    expect(await directory().isMember(ctx, scopeOf(b), Number(manager.id))).toBe(false);
    expect(await memberCount(b, await roleId(b, 'manager'))).toBe(twinCountBefore);
    expect(twinCountBefore).toBeGreaterThan(0);
  });

  it('leaves a custom role it held free to delete', async () => {
    // Arrange
    const { a } = businesses;
    await actAsInNewSession(adminClient, a.owner, a.stores[0]);
    const role = await new RoleApi(adminClient).create(
      allStoresRole(`Departed ${String(counter)}`, { orders: 'view' }),
    );
    const holder = await member(a);
    await setAs(a.owner, a, { administratorId: holder.id, roleIds: [role.id], storeAccess: 'all' });
    await softDelete(holder.id);
    await actAsInNewSession(adminClient, a.owner, a.stores[0]);

    // Act
    await new RoleApi(adminClient).remove(role.id);

    // Assert
    expect(await new RoleApi(adminClient).get(role.id)).toBeNull();
  });

  it('does not count as another all-stores Owner holder', async () => {
    // Arrange
    const { a } = businesses;
    const owner = await roleId(a, 'owner');
    const coOwner = await member(a);
    const storeOwner = await member(a);
    await setAs(a.owner, a, { administratorId: coOwner.id, roleIds: [owner], storeAccess: 'all' });
    await setAs(a.owner, a, {
      administratorId: storeOwner.id,
      roleIds: [owner],
      storeAccess: 'selected',
      storeIds: [a.stores[0].id],
    });
    await softDelete(await rows.administratorId(a.owner));

    // Act
    const failure = await failureOf(
      setAs(storeOwner.credentials, a, {
        administratorId: coOwner.id,
        roleIds: [await roleId(a, 'manager')],
        storeAccess: 'all',
      }),
    );

    // Assert
    expect(failure.codes).toEqual(['rbac.last-owner']);
  });
});
