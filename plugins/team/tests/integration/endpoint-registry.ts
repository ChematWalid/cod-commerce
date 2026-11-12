/**
 * The registry of every Team handler: its method or operation, route, permission, a call aimed at a target's ids, and
 * what another business gets back. The coverage test and the isolation sweep both read it.
 */
import {
  commission,
  commissionInput,
  IDEMPOTENCY_KEY,
  inviteInput,
  member,
  NO_IDS,
  type OperationEntry,
} from './registry-calls';

export {
  type Access,
  type ForeignOutcome,
  type OperationEntry,
  operationKey,
  type RouteEntry,
  routeKey,
  type TargetIds,
} from './registry-calls';
export { ROUTE_REGISTRY } from './route-registry';

/** Every Admin API operation the plugin's resolvers declare. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    operation: 'inviteMember',
    access: 'team.members.invite',
    foreign: 'refused',
    document: 'mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id } }',
    variables: (ids) => ({ input: inviteInput(ids) }),
  },
  {
    operation: 'resendInvitation',
    access: 'team.members.invite',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { resendInvitation(memberId: $id) { id } }',
    variables: (ids) => ({ id: ids.invitedMemberId }),
  },
  {
    operation: 'revokeInvitation',
    access: 'team.members.invite',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { revokeInvitation(memberId: $id) }',
    variables: (ids) => ({ id: ids.invitedMemberId }),
  },
  {
    operation: 'teamMembers',
    access: 'team.members.view',
    foreign: 'own-only',
    document: 'query ($input: TeamMembersInput) { teamMembers(input: $input) { total items { id email } } }',
    variables: () => ({ input: { tab: 'all', page: 1 } }),
  },
  {
    operation: 'teamMember',
    access: 'team.members.view',
    foreign: 'not-found',
    document: 'query ($id: String!) { teamMember(id: $id) { id } }',
    variables: member,
  },
  {
    operation: 'teamOrderManagers',
    access: 'team.members.view',
    foreign: 'own-only',
    document: 'query { teamOrderManagers { id } }',
    variables: NO_IDS,
  },
  {
    operation: 'updateTeamMember',
    access: 'team.members.edit',
    foreign: 'not-found',
    document:
      'mutation ($id: String!, $input: UpdateTeamMemberInput!) { updateTeamMember(id: $id, input: $input) { id } }',
    variables: (ids) => ({ id: ids.memberId, input: { baseSalary: 0 } }),
  },
  {
    operation: 'setTeamMemberLimit',
    access: 'team.members.edit',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { setTeamMemberLimit(id: $id, maxOpenOrders: 5) { id } }',
    variables: member,
  },
  {
    operation: 'setTeamMemberReceiving',
    access: 'team.members.edit',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { setTeamMemberReceiving(id: $id, receivingOrders: false) { id } }',
    variables: member,
  },
  {
    operation: 'deactivateTeamMember',
    access: 'team.members.edit',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { deactivateTeamMember(id: $id) { id } }',
    variables: member,
  },
  {
    operation: 'reactivateTeamMember',
    access: 'team.members.edit',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { reactivateTeamMember(id: $id) { id } }',
    variables: member,
  },
  {
    operation: 'removeTeamMember',
    access: 'team.members.remove',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { removeTeamMember(id: $id) }',
    variables: member,
  },
  {
    operation: 'payTeamMember',
    access: 'team.members.edit',
    foreign: 'not-found',
    document: `mutation ($id: String!) { payTeamMember(id: $id, idempotencyKey: "${IDEMPOTENCY_KEY}") { id } }`,
    variables: member,
  },
  {
    operation: 'teamCommissionConfigs',
    access: 'team.commissions.view',
    foreign: 'own-only',
    document: 'query { teamCommissionConfigs { id name } }',
    variables: NO_IDS,
  },
  {
    operation: 'teamCommissionConfig',
    access: 'team.commissions.view',
    foreign: 'not-found',
    document: 'query ($id: String!) { teamCommissionConfig(id: $id) { id } }',
    variables: commission,
  },
  {
    operation: 'teamCommissionBases',
    access: 'team.commissions.view',
    foreign: 'own-only',
    document: 'query { teamCommissionBases { basis } }',
    variables: NO_IDS,
  },
  {
    operation: 'createTeamCommissionConfig',
    access: 'team.commissions.set',
    foreign: 'refused',
    document: 'mutation ($input: TeamCommissionConfigInput!) { createTeamCommissionConfig(input: $input) { id } }',
    variables: (ids) => ({ input: commissionInput(ids) }),
  },
  {
    operation: 'updateTeamCommissionConfig',
    access: 'team.commissions.edit',
    foreign: 'not-found',
    document:
      'mutation ($id: String!, $input: UpdateTeamCommissionConfigInput!) { updateTeamCommissionConfig(id: $id, input: $input) { id } }',
    variables: (ids) => ({ id: ids.commissionId, input: { value: 2 } }),
  },
  {
    operation: 'deleteTeamCommissionConfig',
    access: 'team.commissions.delete',
    foreign: 'not-found',
    document: 'mutation ($id: String!) { deleteTeamCommissionConfig(id: $id) }',
    variables: commission,
  },
];
