import gql from 'graphql-tag';

/** The Team Admin API. Our ids are `String` (D1); a core administrator id crosses as decimal text (D68). */
export const teamAdminApiSchema = gql`
  enum TeamMemberStatus {
    invited
    active
    inactive
  }

  enum TeamStoreAccess {
    all
    selected
  }

  enum TeamEmailLocale {
    ar
    en
  }

  type TeamMember {
    id: String!
    administratorId: String
    email: String!
    firstName: String
    lastName: String
    status: TeamMemberStatus!
    commissionConfigIds: [String!]!
    "Whole DZD; null for a caller without team.members.edit (D207)."
    baseSalary: Int
    maxOpenOrders: Int
    receivingOrders: Boolean!
    invitedAt: DateTime
    joinedAt: DateTime
  }

  input InviteMemberInput {
    email: String!
    roleIds: [String!]!
    storeAccess: TeamStoreAccess!
    storeIds: [String!]
    baseSalary: Int!
    commissionConfigIds: [String!]
    locale: TeamEmailLocale
  }

  extend type Mutation {
    "Invites a person by email; the link reaches them once the invitation is stored."
    inviteMember(input: InviteMemberInput!): TeamMember!
    "Mails a pending member a new link; the previous link stops working."
    resendInvitation(memberId: String!): TeamMember!
    "Withdraws a pending invitation; the address can be invited again."
    revokeInvitation(memberId: String!): Boolean!
  }
`;
