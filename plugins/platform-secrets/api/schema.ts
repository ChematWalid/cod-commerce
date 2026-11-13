import gql from 'graphql-tag';

/**
 * The Admin API of the tenant secrets (D114). The value is write-only: `SetTenantSecretInput` takes it and no type
 * has a field for it. Ids are `String!` (D1, D68). The business is the caller's, never an argument.
 */
export const adminApiSchema = gql`
  type TenantSecret {
    id: String!
    provider: String!
    ref: String!
    "The last four characters of a value of 12 characters or more; null for a shorter one."
    last4: String
    updatedAt: DateTime!
  }

  input SetTenantSecretInput {
    provider: String!
    ref: String!
    "Written, never read back: 1 to 4096 bytes."
    value: String!
  }

  extend type Query {
    "The caller's business's secrets, without their values."
    tenantSecrets: [TenantSecret!]!
  }

  extend type Mutation {
    "Stores or replaces the secret under (provider, ref); a replaced secret keeps its id."
    setTenantSecret(input: SetTenantSecretInput!): TenantSecret!
    "Deletes one of the caller's secrets; another business's id is not found."
    deleteTenantSecret(id: String!): Boolean!
  }
`;
