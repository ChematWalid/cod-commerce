import { randomBytes } from 'node:crypto';
import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import { PERMISSION_CATALOG, toBusinessId, toSnowflake, vendurePermissionName } from '@cod/shared';
import {
  createTwoBusinesses,
  failureOf,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import {
  Administrator,
  AuthenticatedSession,
  Channel,
  ConfigService,
  Permission,
  RequestContextService,
  Role,
  Seller,
  TransactionalConnection,
  User,
} from '@vendure/core';
import gql from 'graphql-tag';
import type { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ENGINE_ROLES, ROLE_BINDINGS } from '../../application/tokens';
import { ALL_STORES_SCOPE } from '../../domain/constants';
import type { EngineRolesPort } from '../../domain/ports/engine-roles.port';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { RoleBindingRepositoryPort } from '../../domain/ports/role-binding-repository.port';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { MemberRoleAssignmentEntity } from '../../infrastructure/member-role-assignment.entity';
import { RoleBindingEntity } from '../../infrastructure/role-binding.entity';
import {
  CANCEL_ORDER,
  CREATE_STORE,
  FORBIDDEN_STOCK_OPERATIONS,
  PROVISION_BUSINESS,
  STOCK_ADMINISTRATORS,
} from './built-in-roles-kit';
import { actAs } from './rbac-kit';
import { createRbacTestEnvironment } from './rbac-test-environment';

const SNOWFLAKE_WORKER_ID = 1014;
const BUILT_IN_COUNT = 7;

interface BusinessRow extends ObjectLiteral {
  readonly ownerRoleId: number;
  readonly ownerAdministratorId: number;
}

describe('Built-in roles at provisioning', () => {
  const { server, adminClient } = createRbacTestEnvironment(SNOWFLAKE_WORKER_ID);
  let businesses: TwoBusinesses;

  const repository = <T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> =>
    server.app.get(TransactionalConnection).rawConnection.getRepository<T>(entity);
  const businessRow = (id: string): Promise<BusinessRow> =>
    repository<BusinessRow>('BusinessEntity').findOneByOrFail({ id });
  const rolesOf = (businessId: string): Promise<BusinessRoleEntity[]> =>
    repository(BusinessRoleEntity).findBy({ businessId });
  const bindingsOf = (businessId: string): Promise<RoleBindingEntity[]> =>
    repository(RoleBindingEntity).findBy({ businessId });
  const assignmentsOf = (businessId: string): Promise<MemberRoleAssignmentEntity[]> =>
    repository(MemberRoleAssignmentEntity).findBy({ businessId });
  const vendureRole = (id: number): Promise<Role> =>
    repository(Role).findOneOrFail({ where: { id }, relations: { channels: true } });
  const context = async (): Promise<OperationContext> =>
    asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  const channelOf = (store: StoreFixture): Promise<Channel> =>
    repository(Channel).findOneByOrFail({ token: store.channelToken });

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    businesses = await createTwoBusinesses(adminClient);
  });

  afterAll(async () => {
    await server.destroy();
  });

  describe('what a new business gets', () => {
    it('has the seven built-in rows at their template sizes', async () => {
      const rows = await rolesOf(businesses.a.businessId);

      const sizes = Object.fromEntries(rows.map((row) => [row.builtInKey ?? '', row.permissions.length]));
      expect(rows).toHaveLength(BUILT_IN_COUNT);
      expect(sizes).toEqual({
        owner: 93,
        manager: 77,
        'order-manager': 19,
        'inventory-manager': 12,
        accountant: 11,
        'order-tracker': 3,
        'store-manager': 23,
      });
    });

    it("has one all-stores binding, Owner's, on the business's own Vendure role", async () => {
      const { ownerRoleId } = await businessRow(businesses.a.businessId);
      const owner = (await rolesOf(businesses.a.businessId)).find((row) => row.builtInKey === 'owner');

      const bindings = await bindingsOf(businesses.a.businessId);

      expect(bindings).toHaveLength(1);
      expect(bindings[0]).toMatchObject({
        businessRoleId: owner?.id,
        scope: ALL_STORES_SCOPE,
        vendureRoleId: ownerRoleId,
      });
    });

    it('assigns Owner to the first administrator, on all stores', async () => {
      const { ownerAdministratorId } = await businessRow(businesses.a.businessId);

      const assignments = await assignmentsOf(businesses.a.businessId);

      expect(assignments).toHaveLength(1);
      expect(assignments[0]).toMatchObject({ administratorId: ownerAdministratorId, storeAccess: 'all' });
    });

    it('gives each business its own rows and its own Vendure role', async () => {
      const [rolesA, rolesB] = await Promise.all([rolesOf(businesses.a.businessId), rolesOf(businesses.b.businessId)]);
      const [bindingA, bindingB] = await Promise.all([
        bindingsOf(businesses.a.businessId),
        bindingsOf(businesses.b.businessId),
      ]);

      expect(rolesB).toHaveLength(BUILT_IN_COUNT);
      expect(rolesA.map((row) => row.id)).not.toEqual(expect.arrayContaining(rolesB.map((row) => row.id)));
      expect(bindingB).toHaveLength(1);
      expect(bindingA[0]?.vendureRoleId).not.toBe(bindingB[0]?.vendureRoleId);
    });

    it('holds every catalog permission and only Authenticated from the stock set', async () => {
      const { ownerRoleId } = await businessRow(businesses.a.businessId);

      const { permissions } = await vendureRole(ownerRoleId);

      const stock = Object.values(Permission) as string[];
      expect(permissions.filter((name) => stock.includes(name))).toEqual([Permission.Authenticated]);
      expect(permissions).not.toContain(Permission.ReadChannel);
      expect(permissions).toEqual(
        expect.arrayContaining(PERMISSION_CATALOG.map(({ key }) => vendurePermissionName(key))),
      );
    });

    it('gives the owner only the Owner role, on the store channels alone', async () => {
      const { ownerRoleId, ownerAdministratorId } = await businessRow(businesses.a.businessId);

      const administrator = await repository(Administrator).findOneOrFail({
        where: { id: ownerAdministratorId },
        relations: { user: { roles: { channels: true } } },
      });

      expect(administrator.user.roles.map((role) => role.id)).toEqual([ownerRoleId]);
      const channelTokens = administrator.user.roles.flatMap((role) => role.channels.map((channel) => channel.token));
      expect(channelTokens.sort()).toEqual(businesses.a.stores.map((store) => store.channelToken).sort());
      expect(channelTokens).not.toContain(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    });
  });

  describe('what the owner cannot reach', () => {
    it.each(Object.entries(FORBIDDEN_STOCK_OPERATIONS))('refuses %s', async (_name, document) => {
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);

      const failure = await failureOf(adminClient.query(gql(document)));

      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('lets the owner use a catalog permission, and the superadmin the stock list (positive control)', async () => {
      await actAs(adminClient, businesses.a.owner, businesses.a.stores[0]);
      await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });

      adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
      await adminClient.asSuperAdmin();
      const answer = await adminClient.query<{ administrators: { totalItems: number } }>(STOCK_ADMINISTRATORS);
      expect(answer.administrators.totalItems).toBeGreaterThan(0);
    });
  });

  describe('atomicity', () => {
    const rowCounts = (): Promise<number[]> =>
      Promise.all(
        [
          'BusinessEntity',
          'StoreEntity',
          Channel,
          Role,
          Seller,
          User,
          Administrator,
          BusinessRoleEntity,
          RoleBindingEntity,
          MemberRoleAssignmentEntity,
        ].map((entity) => repository(entity as EntityTarget<ObjectLiteral>).count()),
      );

    it('leaves nothing behind when the seed fails partway', async () => {
      adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
      await adminClient.asSuperAdmin();
      const before = await rowCounts();
      const bindings = server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS);
      const suffix = randomBytes(3).toString('hex');
      const failing = vi.spyOn(bindings, 'insert').mockRejectedValueOnce(new Error('forced seed failure'));

      const failure = await failureOf(
        adminClient.query(PROVISION_BUSINESS, {
          input: {
            name: 'Failing SARL',
            owner: {
              emailAddress: `failing-${suffix}@example.test`,
              firstName: 'F',
              lastName: 'Owner',
              password: 'synthetic-owner-password',
            },
            store: { name: 'Failing store', subdomain: `failing-${suffix}`, language: 'ar' },
          },
        }),
      );

      expect(failing).toHaveBeenCalledOnce();
      failing.mockRestore();
      expect(failure.codes.length).toBeGreaterThan(0);
      expect(await rowCounts()).toEqual(before);
    });
  });

  describe('a store opened later', () => {
    const openStore = async (businessKey: 'a' | 'b', label: string): Promise<StoreFixture> => {
      const business = businesses[businessKey];
      await actAs(adminClient, business.owner, business.stores[0]);
      const { createStore } = await adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
        input: { name: label, subdomain: `${label}-${randomBytes(3).toString('hex')}`, language: 'ar' },
      });
      return createStore;
    };

    /** An extra all-stores binding, which only Task 7's use case creates in production. */
    const addManagerBinding = async (businessId: string, store: StoreFixture): Promise<number> => {
      const ctx = await context();
      const manager = (await rolesOf(businessId)).find((row) => row.builtInKey === 'manager');
      const roleId = await server.app.get<EngineRolesPort>(ENGINE_ROLES).createRole(ctx, {
        code: `manager-${randomBytes(3).toString('hex')}`,
        permissions: ['Authenticated'],
        channelIds: [(await channelOf(store)).id as number],
      });
      await server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS).insert(
        ctx,
        { businessId: toBusinessId(businessId) },
        {
          id: server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR).next(),
          businessRoleId: toSnowflake(manager?.id ?? ''),
          scope: ALL_STORES_SCOPE,
          vendureRoleId: roleId,
        },
      );
      return roleId;
    };

    it("extends every all-stores binding of that business, and no other business's", async () => {
      const managerA = await addManagerBinding(businesses.a.businessId, businesses.a.stores[0]);
      const managerB = await addManagerBinding(businesses.b.businessId, businesses.b.stores[0]);
      const { ownerRoleId } = await businessRow(businesses.a.businessId);

      const store = await openStore('a', 'third');

      const channelTokens = async (id: number): Promise<string[]> =>
        (await vendureRole(id)).channels.map((channel) => channel.token);
      expect(await channelTokens(managerA)).toContain(store.channelToken);
      expect(await channelTokens(ownerRoleId)).toContain(store.channelToken);
      expect(await channelTokens(managerB)).not.toContain(store.channelToken);
    });

    it("evicts the owner's cached session after commit and the owner can use the store next request", async () => {
      await actAs(adminClient, businesses.b.owner, businesses.b.stores[0]);
      await adminClient.query(CANCEL_ORDER);
      const cache = server.app.get(ConfigService).authOptions.sessionCacheStrategy;
      const deleted = vi.spyOn(cache, 'delete');
      const sessions = await repository(AuthenticatedSession).findBy({
        user: { identifier: businesses.b.owner.email },
      });

      const { createStore } = await adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
        input: { name: 'fourth', subdomain: `fourth-${randomBytes(3).toString('hex')}`, language: 'ar' },
      });

      await vi.waitFor(() => {
        expect(deleted.mock.calls.map(([token]) => token)).toEqual(
          expect.arrayContaining(sessions.map((session) => session.token)),
        );
      });
      deleted.mockRestore();
      adminClient.setChannelToken(createStore.channelToken);
      await expect(adminClient.query(CANCEL_ORDER)).resolves.toEqual({ rbacTestCancelOrder: true });
    });
  });
});
