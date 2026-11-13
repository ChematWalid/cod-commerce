import { type IsolationCase, ownerGraphql, ownerRest, victimChannel } from '../matrix';

const ACCESS_FIELDS = 'administratorId roles { id name } storeAccess storeIds';
const ACTIVITY_FIELDS = 'items { id action entityType entityId summary actor { id name } storeId } nextCursor';
const ACTIVITY_LOG = `query ($input: ActivityLogInput) { activityLog(input: $input) { ${ACTIVITY_FIELDS} } }`;
const SET_ACCESS = `mutation ($input: SetMemberAccessInput!) { setMemberAccess(input: $input) { ${ACCESS_FIELDS} } }`;
const MEMBER_ACCESS = `query ($id: String!) { memberAccess(administratorId: $id) { ${ACCESS_FIELDS} } }`;
const FORBIDDEN = 403;

/** A `setMemberAccess` input giving one role on one store. */
const selectedAccess = (administratorId: string, roleId: string, storeId: string) => ({
  administratorId,
  roleIds: [roleId],
  storeAccess: 'selected',
  storeIds: [storeId],
});

/** Member access, effective permissions and the activity log (plugins/rbac), over GraphQL and REST. */
export const MEMBER_ACTIVITY_CASES: readonly IsolationCase[] = [
  {
    id: 'member.own-access',
    entity: 'member',
    endpoint: 'memberAccess(administratorId)',
    access: 'list',
    title: "A's owner reads A's member access: A's role on A1 only",
    request: (a) => ownerGraphql(a, MEMBER_ACCESS, { id: a.member.administratorId }),
    expect: { kind: 'own', mustInclude: (a) => [a.member.administratorId, a.role.id, a.stores[0].id] },
  },
  {
    id: 'member.by-id',
    entity: 'member',
    endpoint: 'memberAccess(administratorId)',
    access: 'read by id',
    title: "A's owner reads B's member access: null",
    request: (a, b) => ownerGraphql(a, MEMBER_ACCESS, { id: b.member.administratorId }),
    expect: { kind: 'null', field: 'memberAccess' },
    reverse: true,
  },
  {
    id: 'member.owner-by-id',
    entity: 'member',
    endpoint: 'memberAccess(administratorId)',
    access: 'read by id',
    title: "A's owner reads B's owner access: null",
    request: (a, b) => ownerGraphql(a, MEMBER_ACCESS, { id: b.owner.administratorId }),
    expect: { kind: 'null', field: 'memberAccess' },
  },
  {
    id: 'member.set-victim-member',
    entity: 'member',
    endpoint: 'setMemberAccess(administratorId)',
    access: 'write',
    title: "A's owner gives B's member an A role: rbac.member-not-found, B's member unchanged",
    request: (a, b) =>
      ownerGraphql(a, SET_ACCESS, {
        input: { administratorId: b.member.administratorId, roleIds: [a.role.id], storeAccess: 'all' },
      }),
    expect: { kind: 'code', code: 'rbac.member-not-found' },
  },
  {
    id: 'member.set-victim-owner',
    entity: 'member',
    endpoint: 'setMemberAccess(administratorId)',
    access: 'write',
    title: "A's owner gives B's owner an A role: rbac.member-not-found, B's owner unchanged",
    request: (a, b) =>
      ownerGraphql(a, SET_ACCESS, {
        input: { administratorId: b.owner.administratorId, roleIds: [a.role.id], storeAccess: 'all' },
      }),
    expect: { kind: 'code', code: 'rbac.member-not-found' },
  },
  {
    id: 'member.set-victim-role',
    entity: 'member',
    endpoint: 'setMemberAccess(roleIds)',
    access: 'write',
    title: "A's owner gives A's member B's role: rbac.role-not-found",
    request: (a, b) =>
      ownerGraphql(a, SET_ACCESS, { input: selectedAccess(a.member.administratorId, b.role.id, a.stores[0].id) }),
    expect: { kind: 'code', code: 'rbac.role-not-found' },
  },
  {
    id: 'member.set-victim-store',
    entity: 'member',
    endpoint: 'setMemberAccess(storeIds)',
    access: 'write',
    title: "A's owner gives A's member B's store: rbac.store-not-accessible",
    request: (a, b) =>
      ownerGraphql(a, SET_ACCESS, { input: selectedAccess(a.member.administratorId, a.role.id, b.stores[0].id) }),
    expect: { kind: 'code', code: 'rbac.store-not-accessible' },
  },
  {
    id: 'member.victim-channel',
    entity: 'member',
    endpoint: 'memberAccess(administratorId)',
    access: 'victim channel',
    title: "A's owner reads A's member access with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, MEMBER_ACCESS, { id: a.member.administratorId }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'member.effective-own',
    entity: 'member',
    endpoint: 'GET /permissions',
    access: 'list',
    title: "A's owner reads what it holds over REST: A1's permissions",
    request: (a) => ownerRest(a, 'GET', '/permissions'),
    expect: { kind: 'own', mustInclude: (a) => [a.stores[0].id] },
  },
  {
    id: 'member.effective-victim-channel',
    entity: 'member',
    endpoint: 'effectivePermissions',
    access: 'victim channel',
    title: "A's owner asks what it holds with B's store token: FORBIDDEN",
    request: (a, b) =>
      ownerGraphql(a, 'query { effectivePermissions { storeId permissions storeAccess } }', {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'member.catalog-victim-channel',
    entity: 'member',
    endpoint: 'permissionCatalog',
    access: 'victim channel',
    title: "A's owner reads the permission catalog with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, 'query { permissionCatalog { areas { id } } }', {}, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'member.rest-effective-victim-channel',
    entity: 'member',
    endpoint: 'GET /permissions',
    access: 'victim channel',
    title: "A's owner reads what it holds over REST with B's store token: 403",
    request: (a, b) => ownerRest(a, 'GET', '/permissions', undefined, victimChannel(b)),
    expect: { kind: 'status', status: FORBIDDEN },
  },
  {
    id: 'member.rest-catalog-victim-channel',
    entity: 'member',
    endpoint: 'GET /permissions/catalog',
    access: 'victim channel',
    title: "A's owner reads the permission catalog over REST with B's store token: 403",
    request: (a, b) => ownerRest(a, 'GET', '/permissions/catalog', undefined, victimChannel(b)),
    expect: { kind: 'status', status: FORBIDDEN },
  },
  {
    id: 'activity.list',
    entity: 'activity log',
    endpoint: 'activityLog',
    access: 'list',
    title: "A's owner reads the role activity: A's rows only, with A's role",
    request: (a) => ownerGraphql(a, ACTIVITY_LOG, { input: { first: 100, entityType: 'role' } }),
    expect: { kind: 'own', mustInclude: (a) => [a.role.id] },
  },
  {
    id: 'activity.victim-entity',
    entity: 'activity log',
    endpoint: 'activityLog(entityId)',
    access: 'read by id',
    title: "A's owner filters the activity log by B's role: no rows",
    request: (a, b) => ownerGraphql(a, ACTIVITY_LOG, { input: { entityType: 'role', entityId: b.role.id } }),
    expect: { kind: 'own', mustInclude: () => [] },
  },
  {
    id: 'activity.victim-actor',
    entity: 'activity log',
    endpoint: 'activityLog(actorAdministratorId)',
    access: 'read by id',
    title: "A's owner filters the activity log by B's owner as actor: no rows",
    request: (a, b) => ownerGraphql(a, ACTIVITY_LOG, { input: { actorAdministratorId: b.owner.administratorId } }),
    expect: { kind: 'own', mustInclude: () => [] },
  },
  {
    id: 'activity.victim-channel',
    entity: 'activity log',
    endpoint: 'activityLog',
    access: 'victim channel',
    title: "A's owner reads the activity log with B's store token: FORBIDDEN",
    request: (a, b) => ownerGraphql(a, ACTIVITY_LOG, { input: { first: 100 } }, victimChannel(b)),
    expect: { kind: 'forbidden' },
  },
];
