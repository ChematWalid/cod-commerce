import gql from 'graphql-tag';

/**
 * The Admin API of the operational flags (D116). Staff only: every operation holds the `PlatformStaff` permission.
 * A flag's key is one of the seeded dotted keys; ids are `String!` (D1, D68).
 */
export const adminApiSchema = gql`
  enum FeatureFlagScope {
    PLAN
    BUSINESS
    STORE
  }

  type FeatureFlagOverride {
    scope: FeatureFlagScope!
    scopeId: String!
    enabled: Boolean!
  }

  type FeatureFlag {
    key: String!
    description: String!
    defaultEnabled: Boolean!
    "0 to 100; a business is inside the rollout when its bucket for this flag is below it."
    rolloutPercent: Int!
    updatedAt: DateTime!
    overrides: [FeatureFlagOverride!]!
  }

  input UpdateFeatureFlagInput {
    key: String!
    defaultEnabled: Boolean
    "An integer from 0 to 100."
    rolloutPercent: Int
    "1 to 200 characters."
    description: String
  }

  input FeatureFlagOverrideInput {
    key: String!
    scope: FeatureFlagScope!
    "A plan key, or the id of an existing business or active store."
    scopeId: String!
    enabled: Boolean!
  }

  input FeatureFlagOverrideKeyInput {
    key: String!
    scope: FeatureFlagScope!
    scopeId: String!
  }

  extend type Query {
    "Every flag with its overrides."
    featureFlags: [FeatureFlag!]!
    "What the flag answers for a business and a store, through the same cache the platform reads."
    evaluateFeatureFlag(key: String!, businessId: String, storeId: String): Boolean!
  }

  extend type Mutation {
    updateFeatureFlag(input: UpdateFeatureFlagInput!): FeatureFlag!
    "Creates or replaces the override for (flag, scope, scopeId)."
    setFeatureFlagOverride(input: FeatureFlagOverrideInput!): FeatureFlag!
    "Removes the override; removing one that is not there changes nothing."
    removeFeatureFlagOverride(input: FeatureFlagOverrideKeyInput!): FeatureFlag!
  }
`;
