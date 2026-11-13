import { type IsolationCase, ownerGraphql, ownerRest, victimChannel } from '../matrix';

const ROLE_FIELDS = 'id name description builtInKey permissions memberCount';
const ROLE_BY_ID = `query ($id: String!) { businessRole(id: $id) { ${ROLE_FIELDS} } }`;
const UPDATE_ROLE =
  'mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id } }';
const CREATE_ROLE = 'mutation ($input: CreateBusinessRoleInput!) { createBusinessRole(input: $input) { id } }';
const DUPLICATE_ROLE = 'mutation ($id: String!) { duplicateBusinessRole(id: $id, locale: "en") { id name } }';
const NOT_FOUND = 404;
const FORBIDDEN = 403;

/** Business roles (plugins/rbac), over GraphQL and REST. */
export const ROLE_CASES: readonly IsolationCase[] = [
  {
    id: 'role.list',
    entity: 'role',
    endpoint: 'businessRoles',
    access: 'list',
    title: "A's owner lists business roles: A's roles only",
    request: (a) => ownerGraphql(a, `query { businessRoles { ${ROLE_FIELDS} } }`),
    expect: { kind: 'own', mustInclude: (a) => [a.role.id, a.role.name] },
    reverse: true,
  },
  {
    id: 'role.by-id',
    entity: 'role',
    endpoint: 'businessRole(id)',
    access: 'read by id',
    title: "A's owner asks for B's role by id: null",
    request: (a, b) => ownerGraphql(a, ROLE_BY_ID, { id: b.role.id }),
    expect: { kind: 'null', field: 'businessRole' },
    reverse: true,
  },
  {
    id: 'role.create-from-victim',
    entity: 'role',
    endpoint: 'createBusinessRole(startFromRoleId)',
    access: 'write',
    title: "A's owner creates a role starting from B's role: rbac.role-not-found",
    request: (a, b) => ownerGraphql(a, CREATE_ROLE, { input: { name: 'Copied over', startFromRoleId: b.role.id } }),
    expect: { kind: 'code', code: 'rbac.role-not-found' },
  },
  {
    id: 'role.duplicate',
    entity: 'role',
    endpoint: 'duplicateBusinessRole(id)',
    access: 'write',
    title: "A's owner duplicates B's role: rbac.role-not-found",
    request: (a, b) => ownerGraphql(a, DUPLICATE_ROLE, { id: b.role.id }),
    expect: { kind: 'code', code: 'rbac.role-not-found' },
  },
  {
    id: 'role.update',
    entity: 'role',
    endpoint: 'updateBusinessRole(id)',
    access: 'write',
    title: "A's owner renames B's role: rbac.role-not-found, B's role unchanged",
    request: (a, b) => ownerGraphql(a, UPDATE_ROLE, { id: b.role.id, input: { name: 'Taken over' } }),
    expect: { kind: 'code', code: 'rbac.role-not-found' },
    reverse: true,
  },
  {
    id: 'role.delete',
    entity: 'role',
    endpoint: 'deleteBusinessRole(id)',
    access: 'write',
    title: "A's owner deletes B's role: rbac.role-not-found, B's role still there",
    request: (a, b) =>
      ownerGraphql(a, 'mutation ($id: String!) { deleteBusinessRole(id: $id) { success } }', { id: b.role.id }),
    expect: { kind: 'code', code: 'rbac.role-not-found' },
  },
  {
    id: 'role.victim-channel',
    entity: 'role',
    endpoint: 'businessRoles',
    access: 'victim channel',
    title: "A's owner lists business roles with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, `query { businessRoles { ${ROLE_FIELDS} } }`, {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
    reverse: true,
  },
  {
    id: 'role.rest-list',
    entity: 'role',
    endpoint: 'GET /roles',
    access: 'list',
    title: "A's owner lists roles over REST: A's roles only",
    request: (a) => ownerRest(a, 'GET', '/roles'),
    expect: { kind: 'own', mustInclude: (a) => [a.role.id, a.role.name] },
  },
  {
    id: 'role.rest-by-id',
    entity: 'role',
    endpoint: 'GET /roles/:id',
    access: 'read by id',
    title: "A's owner reads B's role over REST: 404 rbac.role-not-found",
    request: (a, b) => ownerRest(a, 'GET', `/roles/${b.role.id}`),
    expect: { kind: 'status', status: NOT_FOUND, code: 'rbac.role-not-found' },
  },
  {
    id: 'role.rest-create-from-victim',
    entity: 'role',
    endpoint: 'POST /roles (startFromRoleId)',
    access: 'write',
    title: "A's owner creates a role from B's role over REST: 404 rbac.role-not-found",
    request: (a, b) => ownerRest(a, 'POST', '/roles', { name: 'Copied over REST', startFromRoleId: b.role.id }),
    expect: { kind: 'status', status: NOT_FOUND, code: 'rbac.role-not-found' },
  },
  {
    id: 'role.rest-update',
    entity: 'role',
    endpoint: 'PATCH /roles/:id',
    access: 'write',
    title: "A's owner renames B's role over REST: 404 rbac.role-not-found",
    request: (a, b) => ownerRest(a, 'PATCH', `/roles/${b.role.id}`, { name: 'Taken over' }),
    expect: { kind: 'status', status: NOT_FOUND, code: 'rbac.role-not-found' },
  },
  {
    id: 'role.rest-delete',
    entity: 'role',
    endpoint: 'DELETE /roles/:id',
    access: 'write',
    title: "A's owner deletes B's role over REST: 404 rbac.role-not-found",
    request: (a, b) => ownerRest(a, 'DELETE', `/roles/${b.role.id}`),
    expect: { kind: 'status', status: NOT_FOUND, code: 'rbac.role-not-found' },
  },
  {
    id: 'role.rest-duplicate',
    entity: 'role',
    endpoint: 'POST /roles/:id/duplicate',
    access: 'write',
    title: "A's owner duplicates B's role over REST: 404 rbac.role-not-found",
    request: (a, b) => ownerRest(a, 'POST', `/roles/${b.role.id}/duplicate`, { locale: 'en' }),
    expect: { kind: 'status', status: NOT_FOUND, code: 'rbac.role-not-found' },
  },
  {
    id: 'role.rest-victim-channel',
    entity: 'role',
    endpoint: 'GET /roles',
    access: 'victim channel',
    title: "A's owner lists roles over REST with B's store token: 403",
    request: (a, b) => ownerRest(a, 'GET', '/roles', undefined, victimChannel(b)),
    expect: { kind: 'status', status: FORBIDDEN },
  },
];
