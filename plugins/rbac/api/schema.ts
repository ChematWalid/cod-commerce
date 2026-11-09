import gql from 'graphql-tag';

/** The RBAC Admin API. Our ids are `String` (D1); a core administrator id crosses as decimal text (D68). */
export const adminApiSchema = gql`
  input ActivityLogInput {
    first: Int
    after: String
    actorAdministratorId: String
    action: String
    entityType: String
    entityId: String
  }

  type ActivityActor {
    id: String!
    name: String!
  }

  type ActivityLogItem {
    id: String!
    action: String!
    entityType: String!
    entityId: String!
    summary: String!
    diff: JSON!
    actor: ActivityActor
    ip: String
    storeId: String
    createdAt: DateTime!
  }

  type ActivityLogPage {
    items: [ActivityLogItem!]!
    nextCursor: String
  }

  enum StoreAccessMode {
    all
    selected
  }

  input SetMemberAccessInput {
    administratorId: String!
    roleIds: [String!]!
    storeAccess: StoreAccessMode!
    storeIds: [String!]
  }

  type MemberAccessRole {
    id: String!
    name: String!
  }

  type MemberAccess {
    administratorId: String!
    roles: [MemberAccessRole!]!
    storeAccess: StoreAccessMode!
    storeIds: [String!]!
  }

  type PermissionLabel {
    en: String!
    ar: String!
    fr: String!
  }

  type PermissionCatalogArea {
    id: String!
    order: Int!
    label: PermissionLabel!
  }

  type PermissionCatalogEntry {
    key: String!
    area: String!
    level: String!
    sensitive: Boolean!
    label: PermissionLabel!
  }

  type PermissionCatalog {
    areas: [PermissionCatalogArea!]!
    permissions: [PermissionCatalogEntry!]!
  }

  type EffectivePermissions {
    storeId: String!
    permissions: [String!]!
    storeAccess: StoreAccessMode!
  }

  type BusinessRoleAreaLevel {
    area: String!
    "none, view, full, or custom when the role's keys match no level."
    level: String!
  }

  type BusinessRole {
    id: String!
    name: String!
    description: String
    builtInKey: String
    isBuiltIn: Boolean!
    permissions: [String!]!
    areaLevels: [BusinessRoleAreaLevel!]!
    permissionCount: Int!
    memberCount: Int!
    updatedAt: DateTime!
  }

  input AreaLevelInput {
    area: String!
    level: String!
  }

  input CreateBusinessRoleInput {
    name: String!
    description: String
    startFromRoleId: String
    areaLevels: [AreaLevelInput!]
    grants: [String!]
    revokes: [String!]
  }

  input UpdateBusinessRoleInput {
    name: String
    description: String
    startFromRoleId: String
    areaLevels: [AreaLevelInput!]
    grants: [String!]
    revokes: [String!]
  }

  extend type Query {
    activityLog(input: ActivityLogInput): ActivityLogPage!
    memberAccess(administratorId: String!): MemberAccess
    permissionCatalog: PermissionCatalog!
    effectivePermissions: EffectivePermissions!
    businessRoles: [BusinessRole!]!
    businessRole(id: String!): BusinessRole
  }

  extend type Mutation {
    setMemberAccess(input: SetMemberAccessInput!): MemberAccess!
    createBusinessRole(input: CreateBusinessRoleInput!): BusinessRole!
    updateBusinessRole(id: String!, input: UpdateBusinessRoleInput!): BusinessRole!
    deleteBusinessRole(id: String!): Success!
    duplicateBusinessRole(id: String!, locale: String): BusinessRole!
  }
`;
