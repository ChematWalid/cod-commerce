import gql from 'graphql-tag';

/**
 * Store collections of the active store (D2300, D2314). Names are `StoreCollection*`, never Vendure's stock
 * `Collection` ones (D2101). Collection and asset ids are Vendure ids, so `ID`; the tag and brand ids a rule names are
 * our snowflakes, so `String`. Reads need `catalog.collections.view`, create `.create`, edit `.edit` (also the product
 * lists of a collection or a product), delete `.delete`.
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

  type StoreCollectionProduct {
    productId: ID!
    title: String!
    status: String!
    price: Int!
  }

  type StoreCollectionProductList {
    items: [StoreCollectionProduct!]!
    totalItems: Int!
  }

  type StoreCollectionSlugAvailability {
    slug: String!
    available: Boolean!
  }

  type StoreCollectionRef {
    id: ID!
    title: String!
  }

  type StoreProductCollections {
    manual: [StoreCollectionRef!]!
    automatic: [StoreCollectionRef!]!
  }

  input StoreCollectionProductListInput {
    skip: Int
    take: Int
  }

  input StoreCollectionListInput {
    skip: Int
    take: Int
    search: String
  }

  extend type Query {
    storeCollections(options: StoreCollectionListInput): StoreCollectionList!
    storeCollection(id: ID!): StoreCollection
    storeCollectionProducts(id: ID!, options: StoreCollectionProductListInput): StoreCollectionProductList!
    storeCollectionSlugAvailability(slug: String!, collectionId: ID): StoreCollectionSlugAvailability!
    storeProductCollections(productId: ID!): StoreProductCollections!
  }

  extend type Mutation {
    createStoreCollection(input: CreateStoreCollectionInput!): StoreCollection!
    updateStoreCollection(id: ID!, input: UpdateStoreCollectionInput!): StoreCollection!
    deleteStoreCollection(id: ID!): Boolean!
    setStoreCollectionProducts(id: ID!, productIds: [ID!]!): StoreCollection!
    setStoreProductCollections(productId: ID!, collectionIds: [ID!]!): StoreProductCollections!
  }
`;
