import gql from 'graphql-tag';

const MEMBER_FIELDS = `
  id
  administratorId
  email
  firstName
  lastName
  status
  commissionConfigIds
  baseSalary
  maxOpenOrders
  receivingOrders
  invitedAt
  joinedAt
`;

export const INVITE_MEMBER = gql`
  mutation ($input: InviteMemberInput!) {
    inviteMember(input: $input) { ${MEMBER_FIELDS} }
  }
`;

export const RESEND_INVITATION = gql`
  mutation ($memberId: String!) {
    resendInvitation(memberId: $memberId) { ${MEMBER_FIELDS} }
  }
`;

export const REVOKE_INVITATION = gql`
  mutation ($memberId: String!) {
    revokeInvitation(memberId: $memberId)
  }
`;

export const MEMBER_ACCESS = gql`
  query ($administratorId: String!) {
    memberAccess(administratorId: $administratorId) {
      roles {
        id
      }
      storeAccess
      storeIds
    }
  }
`;

export const ACTIVITY_LOG = gql`
  query ($input: ActivityLogInput) {
    activityLog(input: $input) {
      items {
        action
        entityId
        summary
        diff
        storeId
      }
    }
  }
`;

/** A member as the API answers it. */
export interface MemberAnswer {
  readonly id: string;
  readonly administratorId: string | null;
  readonly email: string;
  readonly status: string;
  readonly baseSalary: number | null;
}

/** The invite input of the GraphQL and REST surfaces. */
export interface InviteInput {
  readonly email: string;
  readonly roleIds: readonly string[];
  readonly storeAccess: 'all' | 'selected';
  readonly storeIds?: readonly string[];
  readonly baseSalary: number;
  readonly commissionConfigIds?: readonly string[];
  readonly locale?: 'ar' | 'en';
}

/** One activity row as the log answers it. */
export interface ActivityItem {
  readonly action: string;
  readonly entityId: string;
  readonly summary: string;
  readonly diff: Readonly<Record<string, unknown>>;
  readonly storeId: string | null;
}

const DETAILS_FIELDS = `
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
  baseSalary
  ordersCount
`;

export const TEAM_MEMBERS = gql`
  query ($input: TeamMembersInput) {
    teamMembers(input: $input) {
      items { ${DETAILS_FIELDS} }
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

export const TEAM_MEMBER = gql`
  query ($id: String!) {
    teamMember(id: $id) { ${DETAILS_FIELDS} }
  }
`;

/** A member as the members list answers it. */
export interface MemberDetailsAnswer {
  readonly id: string;
  readonly administratorId: string | null;
  readonly email: string;
  readonly name: string | null;
  readonly status: string;
  readonly tab: string;
  readonly invitationExpired: boolean;
  readonly roles: readonly { readonly id: string; readonly name: string }[];
  readonly storeAccess: 'all' | 'selected';
  readonly storeIds: readonly string[];
  readonly storeNames: readonly string[];
  readonly baseSalary: number | null;
  readonly ordersCount: number;
}

/** One page of the members list as the API answers it. */
export interface MemberPageAnswer {
  readonly items: readonly MemberDetailsAnswer[];
  readonly counts: Readonly<Record<'all' | 'active' | 'pending' | 'inactive', number>>;
  readonly total: number;
}

export const UPDATE_TEAM_MEMBER = gql`
  mutation ($id: String!, $input: UpdateTeamMemberInput!) {
    updateTeamMember(id: $id, input: $input) { ${MEMBER_FIELDS} }
  }
`;

export const DEACTIVATE_TEAM_MEMBER = gql`
  mutation ($id: String!) {
    deactivateTeamMember(id: $id) { ${MEMBER_FIELDS} }
  }
`;

export const PAY_TEAM_MEMBER = gql`
  mutation ($id: String!, $idempotencyKey: String!) {
    payTeamMember(id: $id, idempotencyKey: $idempotencyKey) {
      id
      memberId
      amount
      idempotencyKey
      paidAt
    }
  }
`;

export const TEAM_ORDER_MANAGERS = gql`
  query {
    teamOrderManagers {
      id
      name
      maxOpenOrders
      storeAccess
      storeIds
    }
  }
`;

/** rbac's own access mutation, which must not undo a deactivation sideways (D204). */
export const SET_MEMBER_ACCESS = gql`
  mutation ($input: SetMemberAccessInput!) {
    setMemberAccess(input: $input) {
      administratorId
    }
  }
`;

export const DELETE_BUSINESS_ROLE = gql`
  mutation ($id: String!) {
    deleteBusinessRole(id: $id) {
      success
    }
  }
`;

/** A salary payment as the API answers it. */
export interface PaymentAnswer {
  readonly id: string;
  readonly memberId: string;
  readonly amount: number;
  readonly idempotencyKey: string;
  readonly paidAt: string;
}
