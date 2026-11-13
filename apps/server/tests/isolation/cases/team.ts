import type { MatrixRequest } from '../http';
import {
  type Expectation,
  type IsolationCase,
  type IsolationEntity,
  onChannel,
  ownerGraphql,
  ownerRest,
  victimChannel,
} from '../matrix';
import { TEAM_WORLDS, type TeamWorld } from '../team-world';
import type { BusinessWorld } from '../world';

/** The matrix rows of Team (P1.S4). */
const TEAM_MEMBER: IsolationEntity = 'team member';
const INVITATION: IsolationEntity = 'invitation';
const COMMISSION: IsolationEntity = 'commission';
const SALARY: IsolationEntity = 'salary payment';

const MEMBER_NOT_FOUND = 'team.member-not-found';
const COMMISSION_NOT_FOUND = 'team.commission-not-found';
const INVITATION_INVALID = 'team.invitation-invalid';
const NOT_FOUND = 404;
const FORBIDDEN = 403;
const BAD_REQUEST = 400;
const PAY_KEY = 'isolation-pay';

const MEMBER_FIELDS = 'id administratorId email name status storeIds storeNames commissionConfigIds baseSalary';
const COMMISSION_FIELDS = 'id name basis valueKind value scope storeIds';
const members = (tab: string) =>
  `query { teamMembers(input: { tab: ${tab} }) { total counts { all pending } items { ${MEMBER_FIELDS} } } }`;
const ORDER_MANAGERS = 'query { teamOrderManagers { id name maxOpenOrders storeAccess storeIds } }';
const COMMISSIONS = `query { teamCommissionConfigs { ${COMMISSION_FIELDS} } }`;
const MEMBER = `query ($id: String!) { teamMember(id: $id) { ${MEMBER_FIELDS} } }`;
const COMMISSION_BY_ID = `query ($id: String!) { teamCommissionConfig(id: $id) { ${COMMISSION_FIELDS} } }`;
const UPDATE =
  'mutation ($id: String!, $input: UpdateTeamMemberInput!) { updateTeamMember(id: $id, input: $input) { id } }';
const LIMIT = 'mutation ($id: String!) { setTeamMemberLimit(id: $id, maxOpenOrders: 5) { id } }';
const RECEIVING = 'mutation ($id: String!) { setTeamMemberReceiving(id: $id, receivingOrders: false) { id } }';
const DEACTIVATE = 'mutation ($id: String!) { deactivateTeamMember(id: $id) { id } }';
const REACTIVATE = 'mutation ($id: String!) { reactivateTeamMember(id: $id) { id } }';
const REMOVE = 'mutation ($id: String!) { removeTeamMember(id: $id) }';
const PAY = `mutation ($id: String!) { payTeamMember(id: $id, idempotencyKey: "${PAY_KEY}") { id amount } }`;
const RESEND = 'mutation ($id: String!) { resendInvitation(memberId: $id) { id email } }';
const REVOKE = 'mutation ($id: String!) { revokeInvitation(memberId: $id) }';
const UPDATE_COMMISSION = `mutation ($id: String!, $input: UpdateTeamCommissionConfigInput!) {
  updateTeamCommissionConfig(id: $id, input: $input) { id }
}`;
const DELETE_COMMISSION = 'mutation ($id: String!) { deleteTeamCommissionConfig(id: $id) }';
const CREATE_COMMISSION =
  'mutation ($input: TeamCommissionConfigInput!) { createTeamCommissionConfig(input: $input) { id } }';
const INVITE = 'mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id email } }';

/** The Team rows of `business`. @throws Error when the controller has not run `seedTeam` for it. */
function teamOf(business: BusinessWorld): TeamWorld {
  const team = TEAM_WORLDS.get(business.label);
  if (team === undefined) throw new Error(`no Team rows for business ${business.label}: seedTeam must run first`);
  return team;
}

/** Which of B's Team rows a call names, how a title calls it, its matrix row and the not-found code it answers. */
const TARGETS = {
  owner: { idOf: (t: TeamWorld) => t.ownerMemberId, name: 'owner member row', entity: TEAM_MEMBER },
  invited: { idOf: (t: TeamWorld) => t.invited.memberId, name: 'pending invitation', entity: INVITATION },
  commission: { idOf: (t: TeamWorld) => t.commission.id, name: 'commission config', entity: COMMISSION },
} as const;
type Target = keyof typeof TARGETS;
const codeOf = (on: Target): string => (on === 'commission' ? COMMISSION_NOT_FOUND : MEMBER_NOT_FOUND);

/**
 * Where a call goes: a GraphQL document, or a REST `METHOD /path` (`:id` is the named row's id). The operation or
 * route names the endpoint.
 */
type Source = string;
const isRest = (source: Source): boolean => /^(GET|POST|PATCH|DELETE) \//.test(source);
const endpointOf = (source: Source): string =>
  isRest(source) ? (source.split('?')[0] ?? source) : (/\{\s*(\w+)/.exec(source)?.[1] ?? source);

/** A's owner calls `source` on A's store, naming row `id` (`$id`, or `:id` in a route). */
function call(a: BusinessWorld, source: Source, id = '', body?: Record<string, unknown>): MatrixRequest {
  if (!isRest(source)) {
    return ownerGraphql(a, source, { ...(id !== '' && { id }), ...(body && { input: body }) });
  }
  const [method, path] = source.split(' ') as [MatrixRequest['method'], string];
  return ownerRest(a, method, path.replace(':id', id), body);
}

/** One call naming one of B's Team rows, over GraphQL then over REST; the REST body may name the row as `memberId`. */
type ForeignCall = readonly [
  id: string,
  on: Target,
  gql: Source,
  rest: Source,
  body?: Record<string, unknown>,
  options?: { readonly reverse?: boolean; readonly entity?: IsolationEntity },
];

/** The GraphQL and the REST case of a foreign call: both answer the row's not-found code, as for no such row. */
function foreign([id, on, gql, rest, body, options]: ForeignCall): IsolationCase[] {
  const target = TARGETS[on];
  const code = codeOf(on);
  const access = gql.startsWith('query') ? 'read by id' : 'write';
  const base = { entity: options?.entity ?? target.entity, access } as const;
  const input = gql.includes('$input') ? body : undefined;
  const restBody = (rowId: string) => (body?.['memberId'] === undefined ? body : { ...body, memberId: rowId });
  const graphql: IsolationCase = {
    ...base,
    id,
    endpoint: endpointOf(gql),
    title: `A's owner calls ${endpointOf(gql)} on B's ${target.name}: ${code}`,
    request: (a, b) => call(a, gql, target.idOf(teamOf(b)), input),
    expect: { kind: 'code', code },
    ...(options?.reverse === true && { reverse: true }),
  };
  const restCase: IsolationCase = {
    ...base,
    id: `${id}-rest`,
    endpoint: rest,
    title: `A's owner calls ${rest} on B's ${target.name}: ${String(NOT_FOUND)} ${code}`,
    request: (a, b) => call(a, rest, target.idOf(teamOf(b)), restBody(target.idOf(teamOf(b)))),
    expect: { kind: 'status', status: NOT_FOUND, code },
  };
  return [graphql, restCase];
}

/** A list of A's own business: a success holding `rows` of A's Team rows, and nothing of B's. */
function listed(id: string, entity: IsolationEntity, source: Source, rows: (t: TeamWorld) => string[]): IsolationCase {
  const endpoint = endpointOf(source);
  const expect: Expectation = { kind: 'own', mustInclude: (a) => rows(teamOf(a)) };
  const title = `A's owner calls ${endpoint}: A's own rows only`;
  return { id, entity, endpoint, access: 'list', title, request: (a) => call(a, source), expect };
}

/** A call with B's store token, naming B's row `on` if any: FORBIDDEN over GraphQL, 403 over REST. */
function onVictimStore(id: string, entity: IsolationEntity, source: Source, on?: Target): IsolationCase {
  const rest = isRest(source);
  const expect: Expectation = rest ? { kind: 'status', status: FORBIDDEN } : { kind: 'forbidden' };
  const title = `A's owner calls ${endpointOf(source)} with B's store token: ${rest ? String(FORBIDDEN) : 'FORBIDDEN'}`;
  const rowOf = (b: BusinessWorld) => (on === undefined ? '' : TARGETS[on].idOf(teamOf(b)));
  const request = (a: BusinessWorld, b: BusinessWorld) => onChannel(call(a, source, rowOf(b)), victimChannel(b));
  return { id, entity, endpoint: endpointOf(source), access: 'victim channel', title, request, expect };
}

/** An invite of A's own role and store, so only `overrides` can make it fail. */
const ownInvite = (a: BusinessWorld, overrides: Record<string, unknown>) => ({
  email: `isolation-invite-${a.businessId}@example.test`,
  roleIds: [a.role.id],
  storeAccess: 'selected',
  storeIds: [a.stores[0].id],
  baseSalary: 1,
  ...overrides,
});

/** Nobody signed in, on the invitee's public routes (D205): only the token decides, and a guess opens nothing. */
const linkHolder = (method: MatrixRequest['method'], path: string, body?: unknown): MatrixRequest => ({
  method,
  path,
  caller: { label: 'link holder' },
  body,
});

const ownMembers = (t: TeamWorld) => [t.ownerMemberId, t.invited.memberId, t.invited.email];
const ownInvitee = (t: TeamWorld) => [t.invited.memberId, t.invited.email];
const ownOwner = (t: TeamWorld) => [t.ownerMemberId];
const ownCommission = (t: TeamWorld) => [t.commission.id, t.commission.name];

const FOREIGN_CALLS: readonly ForeignCall[] = [
  ['team-member.by-id', 'owner', MEMBER, 'GET /employees/:id', undefined, { reverse: true }],
  ['invitation.by-id', 'invited', MEMBER, 'GET /employees/:id'],
  ['commission.by-id', 'commission', COMMISSION_BY_ID, 'GET /commissions/configs/:id'],
  ['team-member.update', 'owner', UPDATE, 'PATCH /employees/:id', { baseSalary: 1 }],
  ['team-member.limit', 'owner', LIMIT, 'POST /employees/:id/limit', { maxOpenOrders: 5 }],
  ['order-manager.receiving', 'owner', RECEIVING, 'POST /employees/:id/receiving', { receivingOrders: false }],
  ['team-member.deactivate', 'owner', DEACTIVATE, 'POST /employees/:id/deactivate'],
  ['team-member.reactivate', 'owner', REACTIVATE, 'POST /employees/:id/reactivate'],
  ['team-member.remove', 'owner', REMOVE, 'DELETE /employees/:id'],
  ['salary.pay', 'owner', PAY, 'POST /employees/:id/pay', { idempotencyKey: PAY_KEY }, { entity: SALARY }],
  ['invitation.resend', 'invited', RESEND, 'POST /employees/resend-invitation', { memberId: '' }, { reverse: true }],
  ['invitation.revoke', 'invited', REVOKE, 'POST /employees/:id/revoke-invitation'],
  ['commission.update', 'commission', UPDATE_COMMISSION, 'PATCH /commissions/configs/:id', { value: 2 }],
  ['commission.delete', 'commission', DELETE_COMMISSION, 'DELETE /commissions/configs/:id'],
];

/** Writes of A's own rows that name one of B's: each refused as for a row A does not have. */
const CROSS_REFERENCES: readonly IsolationCase[] = [
  {
    id: 'invitation.invite-with-victim-role',
    entity: INVITATION,
    endpoint: 'inviteMember(roleIds)',
    access: 'write',
    title: "A's owner invites with B's business role: rbac.role-not-found",
    request: (a, b) => call(a, INVITE, '', ownInvite(a, { roleIds: [b.role.id] })),
    expect: { kind: 'code', code: 'rbac.role-not-found' },
  },
  {
    id: 'invitation.invite-with-victim-commission',
    entity: COMMISSION,
    endpoint: 'inviteMember(commissionConfigIds)',
    access: 'write',
    title: "A's owner invites with B's commission config: team.commission-not-found",
    request: (a, b) => call(a, INVITE, '', ownInvite(a, { commissionConfigIds: [teamOf(b).commission.id] })),
    expect: { kind: 'code', code: COMMISSION_NOT_FOUND },
  },
  {
    id: 'invitation.invite-with-victim-commission-rest',
    entity: COMMISSION,
    endpoint: 'POST /employees',
    access: 'write',
    title: "A's owner invites with B's commission config over REST: 404 team.commission-not-found",
    request: (a, b) => call(a, 'POST /employees', '', ownInvite(a, { commissionConfigIds: [teamOf(b).commission.id] })),
    expect: { kind: 'status', status: NOT_FOUND, code: COMMISSION_NOT_FOUND },
  },
  {
    id: 'team-member.give-victim-commission',
    entity: COMMISSION,
    endpoint: 'updateTeamMember(commissionConfigIds)',
    access: 'write',
    title: "A's owner gives A's invitee B's commission config: team.commission-not-found",
    request: (a, b) => call(a, UPDATE, teamOf(a).invited.memberId, { commissionConfigIds: [teamOf(b).commission.id] }),
    expect: { kind: 'code', code: COMMISSION_NOT_FOUND },
  },
  {
    id: 'commission.create-on-victim-store',
    entity: COMMISSION,
    endpoint: 'createTeamCommissionConfig(storeIds)',
    access: 'write',
    title: "A's owner scopes a new commission config to B's store: team.invalid-input",
    request: (a, b) =>
      call(a, CREATE_COMMISSION, '', {
        name: `On B ${a.businessId}`,
        basis: 'per-confirmed-order',
        valueKind: 'fixed',
        value: 1,
        scope: 'selected',
        storeIds: [b.stores[0].id],
      }),
    expect: { kind: 'code', code: 'team.invalid-input' },
  },
];

/** The invitee's public routes, guessing B's invited member id as the token: the one id of B's invitation A sees. */
const GUESSED_TOKENS: readonly IsolationCase[] = [
  {
    id: 'invitation.preview-guessed-token',
    entity: INVITATION,
    endpoint: 'GET /team/invitations/preview',
    access: 'read by id',
    title: "A link holder previews with B's invited member id as the token: 400 team.invitation-invalid, nothing of B",
    request: (_a, b) => linkHolder('GET', `/team/invitations/preview?token=${teamOf(b).invited.memberId}`),
    expect: { kind: 'status', status: BAD_REQUEST, code: INVITATION_INVALID },
  },
  {
    id: 'invitation.accept-guessed-token',
    entity: INVITATION,
    endpoint: 'POST /team/invitations/accept',
    access: 'write',
    title: "A link holder accepts with B's invited member id as the token: 400 team.invitation-invalid, no account",
    request: (_a, b) =>
      linkHolder('POST', '/team/invitations/accept', {
        token: teamOf(b).invited.memberId,
        firstName: 'Guess',
        lastName: 'Work',
        password: 'isolation-password-1',
      }),
    expect: { kind: 'status', status: BAD_REQUEST, code: INVITATION_INVALID },
  },
];

/** Team members, invitations, order managers, salary and commissions (plugins/team, P1.S4), over GraphQL and REST. */
export const TEAM_CASES: readonly IsolationCase[] = [
  { ...listed('team-member.list', TEAM_MEMBER, members('all'), ownMembers), reverse: true },
  listed('invitation.list-pending', INVITATION, members('pending'), ownInvitee),
  listed('team-member.list-rest', TEAM_MEMBER, 'GET /employees?tab=all', ownMembers),
  listed('order-manager.list', TEAM_MEMBER, ORDER_MANAGERS, ownOwner),
  listed('order-manager.list-rest', TEAM_MEMBER, 'GET /employees/order-managers', ownOwner),
  listed('commission.list', COMMISSION, COMMISSIONS, ownCommission),
  listed('commission.list-rest', COMMISSION, 'GET /commissions/configs', ownCommission),
  ...FOREIGN_CALLS.flatMap(foreign),
  ...CROSS_REFERENCES,
  ...GUESSED_TOKENS,
  onVictimStore('team-member.victim-channel', TEAM_MEMBER, members('all')),
  onVictimStore('team-member.victim-channel-rest', TEAM_MEMBER, 'GET /employees'),
  onVictimStore('order-manager.victim-channel', TEAM_MEMBER, ORDER_MANAGERS),
  onVictimStore('invitation.victim-channel-revoke', INVITATION, REVOKE, 'invited'),
  onVictimStore('salary.victim-channel-pay', SALARY, PAY, 'owner'),
  onVictimStore('commission.victim-channel', COMMISSION, COMMISSIONS),
  onVictimStore('commission.victim-channel-rest', COMMISSION, 'GET /commissions/configs'),
];
