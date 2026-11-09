import type { PermissionKey } from '@cod/shared';

/** What a handler demands: any signed-in member of the business, or one catalog permission. */
export type Access = 'authenticated' | PermissionKey;

/** One Admin API operation of the plugin, with a call that is valid in shape and carries nothing real. */
export interface OperationEntry {
  readonly operation: string;
  readonly access: Access;
  readonly document: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call that is valid in shape. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** The route as the controllers declare it. */
  readonly route: string;
  readonly access: Access;
  /** The route with its parameters filled. */
  readonly url: string;
  readonly body?: Readonly<Record<string, unknown>>;
}

const ROLE_FIELDS = 'id name';
const NO_ROLE = '1';

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'activityLog',
    access: 'settings.activity-log.view',
    document: 'query { activityLog { nextCursor } }',
    variables: {},
  },
  {
    operation: 'memberAccess',
    access: 'team.members.view',
    document: 'query ($id: String!) { memberAccess(administratorId: $id) { administratorId } }',
    variables: { id: NO_ROLE },
  },
  {
    operation: 'setMemberAccess',
    access: 'team.members.edit',
    document: 'mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { administratorId } }',
    variables: { input: { administratorId: NO_ROLE, roleIds: [], storeAccess: 'all' } },
  },
  {
    operation: 'permissionCatalog',
    access: 'authenticated',
    document: 'query { permissionCatalog { areas { id } } }',
    variables: {},
  },
  {
    operation: 'effectivePermissions',
    access: 'authenticated',
    document: 'query { effectivePermissions { storeId } }',
    variables: {},
  },
  {
    operation: 'businessRoles',
    access: 'team.roles.view',
    document: `query { businessRoles { ${ROLE_FIELDS} } }`,
    variables: {},
  },
  {
    operation: 'businessRole',
    access: 'team.roles.view',
    document: `query ($id: String!) { businessRole(id: $id) { ${ROLE_FIELDS} } }`,
    variables: { id: NO_ROLE },
  },
  {
    operation: 'createBusinessRole',
    access: 'team.roles.create',
    document: `mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { ${ROLE_FIELDS} } }`,
    variables: { input: { name: 'Nobody' } },
  },
  {
    operation: 'updateBusinessRole',
    access: 'team.roles.edit',
    document: `mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { ${ROLE_FIELDS} } }`,
    variables: { id: NO_ROLE, input: { name: 'Nobody' } },
  },
  {
    operation: 'deleteBusinessRole',
    access: 'team.roles.delete',
    document: 'mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }',
    variables: { id: NO_ROLE },
  },
  {
    operation: 'duplicateBusinessRole',
    access: 'team.roles.create',
    document: `mutation ($id: String!) { duplicateBusinessRole(id: $id) { ${ROLE_FIELDS} } }`,
    variables: { id: NO_ROLE },
  },
];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  { method: 'GET', route: '/permissions/catalog', access: 'authenticated', url: '/permissions/catalog' },
  { method: 'GET', route: '/permissions', access: 'authenticated', url: '/permissions' },
  { method: 'GET', route: '/roles', access: 'team.roles.view', url: '/roles' },
  { method: 'POST', route: '/roles', access: 'team.roles.create', url: '/roles', body: { name: 'Nobody' } },
  { method: 'GET', route: '/roles/:id', access: 'team.roles.view', url: `/roles/${NO_ROLE}` },
  {
    method: 'PATCH',
    route: '/roles/:id',
    access: 'team.roles.edit',
    url: `/roles/${NO_ROLE}`,
    body: { name: 'Nobody' },
  },
  { method: 'DELETE', route: '/roles/:id', access: 'team.roles.delete', url: `/roles/${NO_ROLE}` },
  {
    method: 'POST',
    route: '/roles/:id/duplicate',
    access: 'team.roles.create',
    url: `/roles/${NO_ROLE}/duplicate`,
    body: {},
  },
];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
