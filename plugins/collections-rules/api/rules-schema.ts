import gql from 'graphql-tag';

/**
 * The automatic-collection builder of the active store (D2314, D2321): the options a condition can name, a live
 * preview of an unsaved rule (D2331) and the product search of the manual editor. Brand and tag ids are our
 * snowflakes, so `String`. Options and preview need `catalog.collections.view`; product search `.edit`.
 */
export const rulesAdminApiSchema = gql`
  type StoreCollectionRuleName {
    id: String!
    name: String!
  }

  type StoreCollectionRuleOption {
    name: String!
    values: [String!]!
  }

  type StoreCollectionRuleOptions {
    brands: [StoreCollectionRuleName!]!
    tags: [StoreCollectionRuleName!]!
    options: [StoreCollectionRuleOption!]!
  }

  input StoreCollectionPreviewInput {
    rule: StoreCollectionRuleInput!
    skip: Int
    take: Int
  }

  input StoreCollectionProductSearchInput {
    search: String
    skip: Int
    take: Int
  }

  extend type Query {
    storeCollectionRuleOptions: StoreCollectionRuleOptions!
    storeCollectionProductSearch(options: StoreCollectionProductSearchInput): StoreCollectionProductList!
    previewStoreCollectionMatches(input: StoreCollectionPreviewInput!): StoreCollectionProductList!
  }
`;
