import gql from 'graphql-tag';

/**
 * Store collections of the active store (D2300, D2314). Names are `StoreCollection*`, never Vendure's stock
 * `Collection` ones (D2101). Collection and asset ids are Vendure ids, so `ID`; the tag and brand ids a rule names are
 * our snowflakes, so `String`. Reads need `catalog.collections.view`, create `.create`, edit `.edit`, delete `.delete`.
 */
export const collectionsAdminApiSchema = gql`
  type StoreCollectionImage {
    id: ID!
    preview: String!
  }

  type StoreCollectionCondition {
    field: String!
    operator: String!
    option: String
    values: [String!]
    min: Int
    max: Int
    value: Boolean
  }

  type StoreCollectionRule {
    version: Int!
    match: String!
    conditions: [StoreCollectionCondition!]!
  }

  type StoreCollection {
    id: ID!
    title: String!
    slug: String!
    description: String
    featuredAsset: StoreCollectionImage
    mode: String!
    rule: StoreCollectionRule
    visible: Boolean!
    position: Int!
    productCount: Int!
  }

  type StoreCollectionList {
    items: [StoreCollection!]!
    totalItems: Int!
  }

  input StoreCollectionConditionInput {
    field: String!
    operator: String!
    option: String
    values: [String!]
    min: Int
    max: Int
    value: Boolean
  }

  input StoreCollectionRuleInput {
    version: Int!
    match: String!
    conditions: [StoreCollectionConditionInput!]!
  }

  input CreateStoreCollectionInput {
    title: String!
    slug: String
    description: String
    featuredAssetId: ID
    visible: Boolean!
    position: Int!
    mode: String!
    rule: StoreCollectionRuleInput
  }

  input UpdateStoreCollectionInput {
    title: String
    slug: String
    description: String
    featuredAssetId: ID
    visible: Boolean
    position: Int
    mode: String
    rule: StoreCollectionRuleInput
  }

  input StoreCollectionListInput {
    skip: Int
    take: Int
    search: String
  }

  extend type Query {
    storeCollections(options: StoreCollectionListInput): StoreCollectionList!
    storeCollection(id: ID!): StoreCollection
  }

  extend type Mutation {
    createStoreCollection(input: CreateStoreCollectionInput!): StoreCollection!
    updateStoreCollection(id: ID!, input: UpdateStoreCollectionInput!): StoreCollection!
    deleteStoreCollection(id: ID!): Boolean!
  }
`;
