import type { PermissionKey } from '@cod/shared';

/**
 * What a handler demands: one catalog permission, or nobody (the two invitation routes the invitee calls with a
 * token, D205).
 */
export type Access = 'public' | PermissionKey;

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

const NO_MEMBER = '1';
const NO_COMMISSION = '1';
const COMMISSION_INPUT = {
  name: 'Synthetic commission',
  basis: 'per-confirmed-order',
  valueKind: 'fixed',
  value: 1,
  scope: 'all',
};
const INVITE_INPUT = {
  email: 'nobody@example.test',
  roleIds: ['1'],
  storeAccess: 'all',
  baseSalary: 0,
};

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'inviteMember',
    access: 'team.members.invite',
    document: 'mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id } }',
    variables: { input: INVITE_INPUT },
  },
  {
    operation: 'resendInvitation',
    access: 'team.members.invite',
    document: 'mutation ($id: String!) { resendInvitation(memberId: $id) { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'revokeInvitation',
    access: 'team.members.invite',
    document: 'mutation ($id: String!) { revokeInvitation(memberId: $id) }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'teamMembers',
    access: 'team.members.view',
    document: 'query ($input: TeamMembersInput) { teamMembers(input: $input) { total } }',
    variables: { input: { tab: 'all', page: 1 } },
  },
  {
    operation: 'teamMember',
    access: 'team.members.view',
    document: 'query ($id: String!) { teamMember(id: $id) { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'teamOrderManagers',
    access: 'team.members.view',
    document: 'query { teamOrderManagers { id } }',
    variables: {},
  },
  {
    operation: 'updateTeamMember',
    access: 'team.members.edit',
    document:
      'mutation ($id: String!, $input: UpdateTeamMemberInput!) { updateTeamMember(id: $id, input: $input) { id } }',
    variables: { id: NO_MEMBER, input: { baseSalary: 0 } },
  },
  {
    operation: 'setTeamMemberLimit',
    access: 'team.members.edit',
    document: 'mutation ($id: String!) { setTeamMemberLimit(id: $id, maxOpenOrders: 5) { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'setTeamMemberReceiving',
    access: 'team.members.edit',
    document: 'mutation ($id: String!) { setTeamMemberReceiving(id: $id, receivingOrders: false) { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'deactivateTeamMember',
    access: 'team.members.edit',
    document: 'mutation ($id: String!) { deactivateTeamMember(id: $id) { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'reactivateTeamMember',
    access: 'team.members.edit',
    document: 'mutation ($id: String!) { reactivateTeamMember(id: $id) { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'removeTeamMember',
    access: 'team.members.remove',
    document: 'mutation ($id: String!) { removeTeamMember(id: $id) }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'payTeamMember',
    access: 'team.members.edit',
    document: 'mutation ($id: String!) { payTeamMember(id: $id, idempotencyKey: "synthetic-key") { id } }',
    variables: { id: NO_MEMBER },
  },
  {
    operation: 'teamCommissionConfigs',
    access: 'team.commissions.view',
    document: 'query { teamCommissionConfigs { id } }',
    variables: {},
  },
  {
    operation: 'teamCommissionConfig',
    access: 'team.commissions.view',
    document: 'query ($id: String!) { teamCommissionConfig(id: $id) { id } }',
    variables: { id: NO_COMMISSION },
  },
  {
    operation: 'teamCommissionBases',
    access: 'team.commissions.view',
    document: 'query { teamCommissionBases { basis } }',
    variables: {},
  },
  {
    operation: 'createTeamCommissionConfig',
    access: 'team.commissions.set',
    document: 'mutation ($input: TeamCommissionConfigInput!) { createTeamCommissionConfig(input: $input) { id } }',
    variables: { input: COMMISSION_INPUT },
  },
  {
    operation: 'updateTeamCommissionConfig',
    access: 'team.commissions.edit',
    document:
      'mutation ($id: String!, $input: UpdateTeamCommissionConfigInput!) { updateTeamCommissionConfig(id: $id, input: $input) { id } }',
    variables: { id: NO_COMMISSION, input: { value: 2 } },
  },
  {
    operation: 'deleteTeamCommissionConfig',
    access: 'team.commissions.delete',
    document: 'mutation ($id: String!) { deleteTeamCommissionConfig(id: $id) }',
    variables: { id: NO_COMMISSION },
  },
];

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  { method: 'POST', route: '/employees', access: 'team.members.invite', url: '/employees', body: INVITE_INPUT },
  {
    method: 'POST',
    route: '/employees/resend-invitation',
    access: 'team.members.invite',
    url: '/employees/resend-invitation',
    body: { memberId: NO_MEMBER },
  },
  {
    method: 'POST',
    route: '/employees/:id/revoke-invitation',
    access: 'team.members.invite',
    url: `/employees/${NO_MEMBER}/revoke-invitation`,
  },
  { method: 'GET', route: '/employees', access: 'team.members.view', url: '/employees?tab=all&page=1' },
  { method: 'GET', route: '/employees/:id', access: 'team.members.view', url: `/employees/${NO_MEMBER}` },
  {
    method: 'GET',
    route: '/employees/order-managers',
    access: 'team.members.view',
    url: '/employees/order-managers',
  },
  {
    method: 'PATCH',
    route: '/employees/:id',
    access: 'team.members.edit',
    url: `/employees/${NO_MEMBER}`,
    body: { baseSalary: 0 },
  },
  {
    method: 'POST',
    route: '/employees/:id/limit',
    access: 'team.members.edit',
    url: `/employees/${NO_MEMBER}/limit`,
    body: { maxOpenOrders: 5 },
  },
  {
    method: 'POST',
    route: '/employees/:id/receiving',
    access: 'team.members.edit',
    url: `/employees/${NO_MEMBER}/receiving`,
    body: { receivingOrders: false },
  },
  {
    method: 'POST',
    route: '/employees/:id/deactivate',
    access: 'team.members.edit',
    url: `/employees/${NO_MEMBER}/deactivate`,
  },
  {
    method: 'POST',
    route: '/employees/:id/reactivate',
    access: 'team.members.edit',
    url: `/employees/${NO_MEMBER}/reactivate`,
  },
  { method: 'DELETE', route: '/employees/:id', access: 'team.members.remove', url: `/employees/${NO_MEMBER}` },
  {
    method: 'POST',
    route: '/employees/:id/pay',
    access: 'team.members.edit',
    url: `/employees/${NO_MEMBER}/pay`,
    body: { idempotencyKey: 'synthetic-key' },
  },
  {
    method: 'GET',
    route: '/commissions/configs/actions',
    access: 'team.commissions.view',
    url: '/commissions/configs/actions',
  },
  { method: 'GET', route: '/commissions/configs', access: 'team.commissions.view', url: '/commissions/configs' },
  {
    method: 'POST',
    route: '/commissions/configs',
    access: 'team.commissions.set',
    url: '/commissions/configs',
    body: COMMISSION_INPUT,
  },
  {
    method: 'GET',
    route: '/commissions/configs/:id',
    access: 'team.commissions.view',
    url: `/commissions/configs/${NO_COMMISSION}`,
  },
  {
    method: 'PATCH',
    route: '/commissions/configs/:id',
    access: 'team.commissions.edit',
    url: `/commissions/configs/${NO_COMMISSION}`,
    body: { value: 2 },
  },
  {
    method: 'DELETE',
    route: '/commissions/configs/:id',
    access: 'team.commissions.delete',
    url: `/commissions/configs/${NO_COMMISSION}`,
  },
  {
    method: 'GET',
    route: '/team/invitations/preview',
    access: 'public',
    url: '/team/invitations/preview?token=synthetic-token',
  },
  {
    method: 'POST',
    route: '/team/invitations/accept',
    access: 'public',
    url: '/team/invitations/accept',
    body: { token: 'synthetic-token', firstName: 'No', lastName: 'Body', password: 'synthetic-password-1' },
  },
];

export const operationKey = (entry: OperationEntry): string => entry.operation;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
