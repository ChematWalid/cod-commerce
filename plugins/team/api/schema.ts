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

  "Roles, stores, salary and commissions to change; at least one."
  input UpdateTeamMemberInput {
    roleIds: [String!]
    storeAccess: TeamStoreAccess
    storeIds: [String!]
    baseSalary: Int
    commissionConfigIds: [String!]
  }

  type TeamSalaryPayment {
    id: String!
    memberId: String!
    "Whole DZD: the member's base salary when paid."
    amount: Int!
    idempotencyKey: String!
    paidByAdministratorId: String!
    paidAt: DateTime!
  }

  "A member orders can be handed to: active and receiving orders."
  type TeamOrderManager {
    id: String!
    name: String
    maxOpenOrders: Int
    storeAccess: TeamStoreAccess!
    storeIds: [String!]!
  }

  enum TeamCommissionValueKind {
    fixed
    percent
  }

  "A commission structure of the business; stored only, calculated with orders later."
  type TeamCommissionConfig {
    id: String!
    name: String!
    "One of the bases teamCommissionBases lists, such as per-confirmed-order."
    basis: String!
    valueKind: TeamCommissionValueKind!
    "Whole DZD for fixed, basis points for percent (10000 is 100 %)."
    value: Int!
    scope: TeamStoreAccess!
    storeIds: [String!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type TeamCommissionBasisLabels {
    ar: String!
    en: String!
  }

  type TeamCommissionBasisOption {
    basis: String!
    labels: TeamCommissionBasisLabels!
  }

  input TeamCommissionConfigInput {
    name: String!
    basis: String!
    valueKind: TeamCommissionValueKind!
    value: Int!
    scope: TeamStoreAccess!
    storeIds: [String!]
  }

  "Fields of a commission to change; at least one. Stores come with a scope."
  input UpdateTeamCommissionConfigInput {
    name: String
    basis: String
    valueKind: TeamCommissionValueKind
    value: Int
    scope: TeamStoreAccess
    storeIds: [String!]
  }

  extend type Query {
    "A page of the members the caller reaches (D211), newest first."
    teamMembers(input: TeamMembersInput): TeamMemberPage!
    "One member the caller reaches."
    teamMember(id: String!): TeamMemberDetails!
    "The active members receiving orders that the caller reaches (D209)."
    teamOrderManagers: [TeamOrderManager!]!
    "Every commission config of the business, by name."
    teamCommissionConfigs: [TeamCommissionConfig!]!
    teamCommissionConfig(id: String!): TeamCommissionConfig!
    "What a commission can be earned on, labelled in Arabic and English."
    teamCommissionBases: [TeamCommissionBasisOption!]!
  }

  extend type Mutation {
    "Invites a person by email; the link reaches them once the invitation is stored."
    inviteMember(input: InviteMemberInput!): TeamMember!
    "Mails a pending member a new link; the previous link stops working."
    resendInvitation(memberId: String!): TeamMember!
    "Withdraws a pending invitation; the address can be invited again."
    revokeInvitation(memberId: String!): Boolean!
    "Changes roles and stores (through rbac), salary or commissions."
    updateTeamMember(id: String!, input: UpdateTeamMemberInput!): TeamMember!
    "Sets the most open orders the member may hold; null for no limit."
    setTeamMemberLimit(id: String!, maxOpenOrders: Int): TeamMember!
    "Stops or resumes offering the member new orders."
    setTeamMemberReceiving(id: String!, receivingOrders: Boolean!): TeamMember!
    "Withdraws the member's access and keeps it to give back on reactivation."
    deactivateTeamMember(id: String!): TeamMember!
    "Gives a deactivated member its former access back."
    reactivateTeamMember(id: String!): TeamMember!
    "Removes the member and its account; an invited member's invitation is revoked."
    removeTeamMember(id: String!): Boolean!
    "Books one payment of the member's base salary per idempotency key."
    payTeamMember(id: String!, idempotencyKey: String!): TeamSalaryPayment!
    "Adds a commission config; its name is unique in the business, whatever its case."
    createTeamCommissionConfig(input: TeamCommissionConfigInput!): TeamCommissionConfig!
    "Changes a commission config; not one given to the caller's own member row."
    updateTeamCommissionConfig(id: String!, input: UpdateTeamCommissionConfigInput!): TeamCommissionConfig!
    "Deletes a commission config no member is given."
    deleteTeamCommissionConfig(id: String!): Boolean!
  }
`;
