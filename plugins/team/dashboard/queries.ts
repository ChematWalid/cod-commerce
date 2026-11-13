import type { CommissionConfigInput, InviteMemberInput, ListMembersQueryInput, UpdateMemberInput } from '@cod/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@vendure/dashboard';
import {
  COMMISSION_BASES_QUERY_KEY,
  COMMISSIONS_QUERY_KEY,
  EFFECTIVE_PERMISSIONS_QUERY_KEY,
  MEMBERS_QUERY_KEY,
  ROLE_OPTIONS_QUERY_KEY,
  STORE_OPTIONS_QUERY_KEY,
} from './constants';
import type { CommissionBasisDto, CommissionConfigDto, RoleOptionDto, StoreOptionDto, TeamMemberPageDto } from './dto';

const MEMBERS_QUERY = /* GraphQL */ `
  query TeamMembers($input: TeamMembersInput) {
    teamMembers(input: $input) {
      items {
        id
        administratorId
        email
        name
        status
        tab
        invitationExpired
        roles {
          id
          name
        }
        storeAccess
        storeIds
        storeNames
        commissionConfigIds
        baseSalary
        ordersCount
        maxOpenOrders
        receivingOrders
        invitedAt
        joinedAt
      }
      counts {
        all
        active
        pending
        inactive
      }
      total
    }
  }
`;

const EFFECTIVE_PERMISSIONS_QUERY = /* GraphQL */ `
  query TeamEffectivePermissions {
    effectivePermissions {
      permissions
    }
  }
`;

const ROLE_OPTIONS_QUERY = /* GraphQL */ `
  query TeamRoleOptions {
    businessRoles {
      id
      name
      builtInKey
    }
  }
`;

const STORE_OPTIONS_QUERY = /* GraphQL */ `
  query TeamStoreOptions {
    switchableStores {
      stores {
        id
        name
      }
    }
  }
`;

const COMMISSIONS_QUERY = /* GraphQL */ `
  query TeamCommissionConfigs {
    teamCommissionConfigs {
      id
      name
      basis
      valueKind
      value
    }
  }
`;

const COMMISSION_BASES_QUERY = /* GraphQL */ `
  query TeamCommissionBases {
    teamCommissionBases {
      basis
      labels {
        ar
        en
      }
    }
  }
`;

const MEMBER_ID_FIELDS = 'id status';

/** One mutation per member action; each answers the changed member, which the list is refetched for. */
const MUTATIONS = {
  invite: `mutation TeamInvite($input: InviteMemberInput!) { inviteMember(input: $input) { ${MEMBER_ID_FIELDS} } }`,
  resend: `mutation TeamResend($id: String!) { resendInvitation(memberId: $id) { ${MEMBER_ID_FIELDS} } }`,
  revoke: 'mutation TeamRevoke($id: String!) { revokeInvitation(memberId: $id) }',
  update: `mutation TeamUpdate($id: String!, $input: UpdateTeamMemberInput!) {
    updateTeamMember(id: $id, input: $input) { ${MEMBER_ID_FIELDS} } }`,
  limit: `mutation TeamLimit($id: String!, $max: Int) {
    setTeamMemberLimit(id: $id, maxOpenOrders: $max) { ${MEMBER_ID_FIELDS} } }`,
  receiving: `mutation TeamReceiving($id: String!, $on: Boolean!) {
    setTeamMemberReceiving(id: $id, receivingOrders: $on) { ${MEMBER_ID_FIELDS} } }`,
  deactivate: `mutation TeamDeactivate($id: String!) { deactivateTeamMember(id: $id) { ${MEMBER_ID_FIELDS} } }`,
  reactivate: `mutation TeamReactivate($id: String!) { reactivateTeamMember(id: $id) { ${MEMBER_ID_FIELDS} } }`,
  remove: 'mutation TeamRemove($id: String!) { removeTeamMember(id: $id) }',
  pay: `mutation TeamPay($id: String!, $key: String!) {
    payTeamMember(id: $id, idempotencyKey: $key) { id amount paidAt } }`,
  createCommission: `mutation TeamCreateCommission($input: TeamCommissionConfigInput!) {
    createTeamCommissionConfig(input: $input) { id name basis valueKind value } }`,
} as const;

/** The members of `query.tab` the caller reaches (D211), with each tab's count under the same search. */
export function useTeamMembers(query: ListMembersQueryInput): ReturnType<typeof useQuery<TeamMemberPageDto>> {
  return useQuery({
    queryKey: [...MEMBERS_QUERY_KEY, query],
    queryFn: async () =>
      (await api.query<{ readonly teamMembers: TeamMemberPageDto }>(MEMBERS_QUERY, { input: query })).teamMembers,
    retry: false,
  });
}

/** What the server says the caller holds on the active store; empty until it answers, so nothing shows on a guess. */
export function useHeldPermissions(): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: EFFECTIVE_PERMISSIONS_QUERY_KEY,
    queryFn: () =>
      api.query<{ readonly effectivePermissions: { readonly permissions: readonly string[] } }>(
        EFFECTIVE_PERMISSIONS_QUERY,
      ),
    retry: false,
  });
  return new Set(data?.effectivePermissions.permissions ?? []);
}

/** The roles the dialogs offer; only asked for while a dialog is open. */
export function useRoleOptions(enabled: boolean): ReturnType<typeof useQuery<readonly RoleOptionDto[]>> {
  return useQuery({
    queryKey: ROLE_OPTIONS_QUERY_KEY,
    queryFn: async () =>
      (await api.query<{ readonly businessRoles: readonly RoleOptionDto[] }>(ROLE_OPTIONS_QUERY)).businessRoles,
    enabled,
    retry: false,
  });
}

/** The stores the caller holds a role on, which are the stores it may grant. */
export function useStoreOptions(enabled: boolean): ReturnType<typeof useQuery<readonly StoreOptionDto[]>> {
  return useQuery({
    queryKey: STORE_OPTIONS_QUERY_KEY,
    queryFn: async () =>
      (
        await api.query<{ readonly switchableStores: { readonly stores: readonly StoreOptionDto[] } }>(
          STORE_OPTIONS_QUERY,
        )
      ).switchableStores.stores,
    enabled,
    retry: false,
  });
}

export function useCommissionConfigs(enabled: boolean): ReturnType<typeof useQuery<readonly CommissionConfigDto[]>> {
  return useQuery({
    queryKey: COMMISSIONS_QUERY_KEY,
    queryFn: async () =>
      (await api.query<{ readonly teamCommissionConfigs: readonly CommissionConfigDto[] }>(COMMISSIONS_QUERY))
        .teamCommissionConfigs,
    enabled,
    retry: false,
  });
}

export function useCommissionBases(enabled: boolean): ReturnType<typeof useQuery<readonly CommissionBasisDto[]>> {
  return useQuery({
    queryKey: COMMISSION_BASES_QUERY_KEY,
    queryFn: async () =>
      (await api.query<{ readonly teamCommissionBases: readonly CommissionBasisDto[] }>(COMMISSION_BASES_QUERY))
        .teamCommissionBases,
    enabled,
    retry: false,
  });
}

export const inviteMember = (input: InviteMemberInput): Promise<unknown> => api.mutate(MUTATIONS.invite, { input });
export const resendInvitation = (id: string): Promise<unknown> => api.mutate(MUTATIONS.resend, { id });
export const revokeInvitation = (id: string): Promise<unknown> => api.mutate(MUTATIONS.revoke, { id });
export const updateMember = (id: string, input: UpdateMemberInput): Promise<unknown> =>
  api.mutate(MUTATIONS.update, { id, input });
export const setMemberLimit = (id: string, max: number | null): Promise<unknown> =>
  api.mutate(MUTATIONS.limit, { id, max });
export const setMemberReceiving = (id: string, on: boolean): Promise<unknown> =>
  api.mutate(MUTATIONS.receiving, { id, on });
export const deactivateMember = (id: string): Promise<unknown> => api.mutate(MUTATIONS.deactivate, { id });
export const reactivateMember = (id: string): Promise<unknown> => api.mutate(MUTATIONS.reactivate, { id });
export const removeMember = (id: string): Promise<unknown> => api.mutate(MUTATIONS.remove, { id });
/** One payment per `key`: a repeated click with the same key answers the first payment (D212). */
export const payMember = (id: string, key: string): Promise<unknown> => api.mutate(MUTATIONS.pay, { id, key });

export async function createCommissionConfig(input: CommissionConfigInput): Promise<CommissionConfigDto> {
  const answer = (await api.mutate(MUTATIONS.createCommission, { input })) as {
    readonly createTeamCommissionConfig: CommissionConfigDto;
  };
  return answer.createTeamCommissionConfig;
}
