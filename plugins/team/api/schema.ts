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

  enum TeamMemberTab {
    all
    active
    pending
    inactive
  }

  type TeamMemberRole {
    id: String!
    name: String!
  }

  "A member as the members list and the member page show it."
  type TeamMemberDetails {
    id: String!
    administratorId: String
    email: String!
    name: String
    firstName: String
    lastName: String
    status: TeamMemberStatus!
    tab: TeamMemberTab!
    "An invited member whose link ran out: still pending, so it can be resent or revoked."
    invitationExpired: Boolean!
    roles: [TeamMemberRole!]!
    storeAccess: TeamStoreAccess!
    storeIds: [String!]!
    storeNames: [String!]!
    commissionConfigIds: [String!]!
    "Whole DZD; null for a caller without team.members.edit (D207)."
    baseSalary: Int
    "Always 0 until orders exist."
    ordersCount: Int!
    maxOpenOrders: Int
    receivingOrders: Boolean!
    invitedAt: DateTime
    joinedAt: DateTime
  }

  type TeamMemberCounts {
    all: Int!
    active: Int!
    pending: Int!
    inactive: Int!
  }

  type TeamMemberPage {
    items: [TeamMemberDetails!]!
    "Members of each tab under the same search."
    counts: TeamMemberCounts!
    "Members of the requested tab, all pages together."
    total: Int!
  }

  input TeamMembersInput {
    tab: TeamMemberTab
    search: String
    "Counts from 1."
    page: Int
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

  extend type Query {
    "A page of the members the caller reaches (D211), newest first."
    teamMembers(input: TeamMembersInput): TeamMemberPage!
    "One member the caller reaches."
    teamMember(id: String!): TeamMemberDetails!
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
