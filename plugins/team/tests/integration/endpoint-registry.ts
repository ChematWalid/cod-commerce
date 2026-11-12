import type { PermissionKey } from '@cod/shared';

/**
 * What a handler demands: one catalog permission, or nobody (the two invitation routes the invitee calls with a
 * token, D205). Task 16 completes this registry with the list, member, salary and commission handlers.
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
