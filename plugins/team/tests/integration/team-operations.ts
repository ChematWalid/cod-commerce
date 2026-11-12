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
