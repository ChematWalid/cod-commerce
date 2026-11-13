import { randomBytes } from 'node:crypto';
import { SNOWFLAKE_ID_GENERATOR, type SnowflakeIdGeneratorPort } from '@cod/plugin-tenancy';
import { type PermissionKey, toBusinessId, toSnowflake, vendurePermissionName } from '@cod/shared';
import {
  type BusinessFixture,
  type CredentialsFixture,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  type StoreFixture,
} from '@cod/testing';
import {
  Administrator,
  AuthenticatedSession,
  Channel,
  ConfigService,
  RequestContextService,
  Role,
  TransactionalConnection,
} from '@vendure/core';
import type { SimpleGraphQLClient, TestServer } from '@vendure/testing';
import gql from 'graphql-tag';
import type { EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { vi } from 'vitest';
import { RbacConvergeService } from '../../application/rbac-converge.service';
import { BUSINESS_ROLES, ENGINE_ROLES, MEMBER_ASSIGNMENTS, ROLE_BINDINGS } from '../../application/tokens';
import { ALL_STORES_SCOPE } from '../../domain/constants';
import { enginePermissionsFor } from '../../domain/engine-grants';
import type { BusinessRoleRepositoryPort } from '../../domain/ports/business-role-repository.port';
import type { EngineRolesPort } from '../../domain/ports/engine-roles.port';
import type { MemberAssignmentRepositoryPort } from '../../domain/ports/member-assignment-repository.port';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import type { RoleBindingRepositoryPort } from '../../domain/ports/role-binding-repository.port';
import { BusinessRoleEntity } from '../../infrastructure/business-role.entity';
import { MemberRoleAssignmentEntity } from '../../infrastructure/member-role-assignment.entity';
import { RoleBindingEntity } from '../../infrastructure/role-binding.entity';
import { actAs } from './rbac-kit';

const CATALOG_PERMISSION_PREFIX = 'Cod';
const MEMBER_PASSWORD = 'synthetic-member-password';
/** How the test server's id codec prefixes an entity id in GraphQL. */
const TEST_ID_PREFIX = 'T_';

export const UPDATE_STORE = gql`
  mutation ($id: String!, $input: UpdateStoreInput!) {
    updateStore(id: $id, input: $input) {
      id
    }
  }
`;

const CREATE_ADMINISTRATOR = gql`
  mutation ($input: CreateAdministratorInput!) {
    createAdministrator(input: $input) {
      id
    }
  }
`;

interface BusinessRow extends ObjectLiteral {
  readonly ownerRoleId: number;
  readonly ownerAdministratorId: number;
}

/** A member holding Manager on all stores, signed in on the client. */
export interface ManagerMember {
  readonly roleId: number;
  readonly member: CredentialsFixture;
  readonly memberId: number;
}

/** Reads, arrangements and spies of the converge suite. */
export function createConvergeKit(server: TestServer, adminClient: SimpleGraphQLClient) {
  const repository = <T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> =>
    server.app.get(TransactionalConnection).rawConnection.getRepository<T>(entity);
  const businessRow = (id: string): Promise<BusinessRow> =>
    repository<BusinessRow>('BusinessEntity').findOneByOrFail({ id });
  const rolesOf = (businessId: string): Promise<BusinessRoleEntity[]> =>
    repository(BusinessRoleEntity).findBy({ businessId });
  const assignmentsOf = (businessId: string): Promise<MemberRoleAssignmentEntity[]> =>
    repository(MemberRoleAssignmentEntity).findBy({ businessId });
  const vendureRole = (id: number): Promise<Role> =>
    repository(Role).findOneOrFail({ where: { id }, relations: { channels: true } });
  const channelOf = (store: StoreFixture): Promise<Channel> =>
    repository(Channel).findOneByOrFail({ token: store.channelToken });
  const context = async (): Promise<OperationContext> =>
    asOperationContext(await server.app.get(RequestContextService).create({ apiType: 'admin' }));
  const engine = (): EngineRolesPort => server.app.get<EngineRolesPort>(ENGINE_ROLES);
  const converge = (): RbacConvergeService => server.app.get(RbacConvergeService);
  const sessionTokens = async (credentials: CredentialsFixture): Promise<string[]> =>
    (await repository(AuthenticatedSession).findBy({ user: { identifier: credentials.email } })).map(
      (session) => session.token,
    );
  const spyOnCacheDelete = () => vi.spyOn(server.app.get(ConfigService).authOptions.sessionCacheStrategy, 'delete');
  const deletedTokens = (spy: ReturnType<typeof spyOnCacheDelete>): string[] => spy.mock.calls.map(([token]) => token);

  /** The permissions P1.S2 gave an owner: the plugin ones, none of the catalog. */
  const placeholderPermissions = async (ownerRoleId: number): Promise<string[]> =>
    (await vendureRole(ownerRoleId)).permissions.filter((name) => !name.startsWith(CATALOG_PERMISSION_PREFIX));

  /** A business as it stood before this feature: no rbac rows and the placeholder permissions on its Owner role. */
  const arrangeOldBusiness = async (businessId: string): Promise<void> => {
    const { ownerRoleId } = await businessRow(businessId);
    await repository(MemberRoleAssignmentEntity).delete({ businessId });
    await repository(RoleBindingEntity).delete({ businessId });
    await repository(BusinessRoleEntity).delete({ businessId });
    await engine().updatePermissions(await context(), ownerRoleId, await placeholderPermissions(ownerRoleId));
  };

  const arrangeManagerMember = async (
    { businessId, stores }: BusinessFixture,
    managerPermissions: readonly PermissionKey[],
  ): Promise<ManagerMember> => {
    const ctx = await context();
    const scope = { businessId: toBusinessId(businessId) };
    const manager = (await rolesOf(businessId)).find((row) => row.builtInKey === 'manager');
    const ids = server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR);
    const channels = await Promise.all(stores.map(channelOf));
    const roleId = await engine().createRole(ctx, {
      code: `manager-${randomBytes(3).toString('hex')}`,
      permissions: enginePermissionsFor(managerPermissions),
      channelIds: channels.map((channel) => channel.id as number),
    });
    await server.app.get<RoleBindingRepositoryPort>(ROLE_BINDINGS).insert(ctx, scope, {
      id: ids.next(),
      businessRoleId: toSnowflake(manager?.id ?? ''),
      scope: ALL_STORES_SCOPE,
      vendureRoleId: roleId,
    });
    const member = { email: `member-${randomBytes(3).toString('hex')}@example.test`, password: MEMBER_PASSWORD };
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
    await adminClient.query(CREATE_ADMINISTRATOR, {
      input: {
        firstName: 'Member',
        lastName: 'One',
        emailAddress: member.email,
        password: member.password,
        roleIds: [`${TEST_ID_PREFIX}${String(roleId)}`],
      },
    });
    const administrator = await repository(Administrator).findOneByOrFail({ emailAddress: member.email });
    // A member belongs to its business, as `createMember` makes one; rbac ignores administrators of no business.
    await repository(Administrator).update(administrator.id, { customFields: { businessId } });
    await server.app.get<MemberAssignmentRepositoryPort>(MEMBER_ASSIGNMENTS).insert(ctx, scope, {
      id: ids.next(),
      administratorId: administrator.id as number,
      businessRoleId: toSnowflake(manager?.id ?? ''),
      storeAccess: ALL_STORES_SCOPE,
      storeIds: [],
      createdAt: new Date(),
    });
    await actAs(adminClient, member, stores[0]);
    return { roleId, member, memberId: administrator.id as number };
  };

  /** A custom role whose Vendure role lags the engine grants: one grant missing, one no longer granted. */
  const arrangeDriftedCustomRole = async (
    { businessId, stores }: BusinessFixture,
    permission: PermissionKey,
    staleGrant: string,
  ): Promise<number> => {
    const ctx = await context();
    const scope = { businessId: toBusinessId(businessId) };
    const ids = server.app.get<SnowflakeIdGeneratorPort>(SNOWFLAKE_ID_GENERATOR);
    const suffix = randomBytes(3).toString('hex');
    const id = ids.next();
    const now = new Date();
    await server.app.get<BusinessRoleRepositoryPort>(BUSINESS_ROLES).insert(ctx, scope, {
      id,
      name: `Custom ${suffix}`,
      nameKey: `custom ${suffix}`,
      description: null,
      builtInKey: null,
      permissions: [permission],
      createdAt: now,
      updatedAt: now,
    });
    const roleId = await engine().createRole(ctx, {
      code: `custom-${suffix}`,
      permissions: [vendurePermissionName(permission), staleGrant],
      channelIds: [(await channelOf(stores[0])).id as number],
    });
    await server.app
      .get<RoleBindingRepositoryPort>(ROLE_BINDINGS)
      .insert(ctx, scope, { id: ids.next(), businessRoleId: id, scope: ALL_STORES_SCOPE, vendureRoleId: roleId });
    return roleId;
  };

  return {
    repository,
    businessRow,
    rolesOf,
    assignmentsOf,
    vendureRole,
    channelOf,
    context,
    engine,
    converge,
    sessionTokens,
    spyOnCacheDelete,
    deletedTokens,
    arrangeOldBusiness,
    arrangeManagerMember,
    arrangeDriftedCustomRole,
  };
}
