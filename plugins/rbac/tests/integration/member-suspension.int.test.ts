import { RBAC_ERROR_CODES, toBusinessId } from '@cod/shared';
import {
  type CredentialsFixture,
  createMember,
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MemberAccessService } from '../../application/member-access.service';
import type { MemberSuspensionRegistry } from '../../application/member-suspension-registry';
import { MEMBER_SUSPENSION_CHECK } from '../../application/tokens';
import { asOperationContext } from '../../domain/ports/operation-context';
import { type AccessAnswer, type AccessInput, AccessRows, MEMBER_ACCESS, SET_ACCESS } from './member-access-kit';
import { actAsInNewSession } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1004;

interface MemberAccessAnswer {
  readonly memberAccess: { readonly roles: readonly { readonly id: string }[]; readonly storeIds: readonly string[] };
}

describe('a suspended member (D204)', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  const suspended = new Set<number>();
  let businesses: TwoBusinesses;
  let rows: AccessRows;
  let viewerRole: string;
  let managerRole: string;
  let storeOne: string;
  let counter = 0;

  const member = async (): Promise<{ credentials: CredentialsFixture; id: string }> => {
    counter += 1;
    const credentials = await createMember(server.app, adminClient, {
      code: `suspended-${String(counter)}`,
      business: businesses.a,
      store: businesses.a.stores[0],
      permissions: ['Authenticated'],
    });
    return { credentials, id: await rows.administratorId(credentials) };
  };

  const set = (input: AccessInput): Promise<AccessAnswer> => adminClient.query<AccessAnswer>(SET_ACCESS, { input });
  const accessOf = async (id: string): Promise<MemberAccessAnswer['memberAccess']> =>
    (await adminClient.query<MemberAccessAnswer>(MEMBER_ACCESS, { administratorId: id })).memberAccess;
  const asOwner = (): Promise<string> => actAsInNewSession(adminClient, businesses.a.owner, businesses.a.stores[0]);

  /** A member on store one with the viewer role, then suspended. */
  const suspendedViewer = async (): Promise<string> => {
    const { id } = await member();
    await asOwner();
    await set({ administratorId: id, roleIds: [viewerRole], storeAccess: 'selected', storeIds: [storeOne] });
    suspended.add(Number(id));
    return id;
  };

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
    rows = new AccessRows(server.app);
    viewerRole = await rows.roleId(businesses.a.businessId, 'order-manager');
    managerRole = await rows.roleId(businesses.a.businessId, 'manager');
    storeOne = businesses.a.stores[0].id;
    server.app
      .get<MemberSuspensionRegistry>(MEMBER_SUSPENSION_CHECK, { strict: false })
      .register({ isSuspended: (_ctx, _scope, administratorId) => Promise.resolve(suspended.has(administratorId)) });
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('refuses setMemberAccess granting roles, and changes nothing', async () => {
    // Arrange
    const id = await suspendedViewer();
    const before = await accessOf(id);

    // Act
    const failure = await failureOf(set({ administratorId: id, roleIds: [managerRole], storeAccess: 'all' }));

    // Assert
    expect(failure.codes).toEqual([RBAC_ERROR_CODES.MEMBER_SUSPENDED]);
    expect(await accessOf(id)).toEqual(before);
  });

  it('refuses MemberAccessService.setAccess from another plugin, and changes nothing', async () => {
    // Arrange
    const id = await suspendedViewer();
    const before = await accessOf(id);
    const ctx = asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
    const owner = Number(await rows.administratorId(businesses.a.owner));
    const scope = { businessId: toBusinessId(businesses.a.businessId) };

    // Act
    const change = server.app.get(MemberAccessService).setAccess(ctx, {
      actor: { administratorId: owner, scope, ip: null, userAgent: null },
      administratorId: Number(id),
      roleIds: [managerRole],
      storeAccess: 'all',
      storeIds: [],
    });

    // Assert
    await expect(change).rejects.toMatchObject({ code: RBAC_ERROR_CODES.MEMBER_SUSPENDED });
    expect(await accessOf(id)).toEqual(before);
  });

  it('still lets the owner withdraw every role of a suspended member', async () => {
    // Arrange
    const id = await suspendedViewer();

    // Act
    const { setMemberAccess } = await set({ administratorId: id, roleIds: [], storeAccess: 'all' });

    // Assert
    expect(setMemberAccess.roles).toEqual([]);
    expect((await accessOf(id)).roles).toEqual([]);
  });

  it('grants roles as before to a member nobody suspended', async () => {
    // Arrange
    const { id } = await member();
    await asOwner();

    // Act
    const { setMemberAccess } = await set({ administratorId: id, roleIds: [managerRole], storeAccess: 'all' });

    // Assert
    expect(setMemberAccess.roles.map((role) => role.id)).toEqual([managerRole]);
  });
});
