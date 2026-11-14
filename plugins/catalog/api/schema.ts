import gql from 'graphql-tag';

/**
 * The catalog's Admin API (D2101): every name is prefixed so none collides with Vendure's own product API. Vendure
 * ids (products, variants, options, images, collections) are `ID`; our snowflakes (brands, tags, highlights, order
 * managers) are `String` (D1).
 */
export const catalogAdminApiSchema = gql`
  enum CatalogProductStatus {
    active
    hidden
    draft
  }

  type CatalogMediaRef {
    id: ID!
  }

  type CatalogOptionValue {
    id: ID!
    name: String!
  }

  type CatalogOptionGroup {
    id: ID!
    name: String!
    values: [CatalogOptionValue!]!
  }

  type CatalogVariant {
    id: ID!
    name: String!
    sku: String!
    price: Int!
    oldPrice: Int
    barcode: String
    isHidden: Boolean!
    optionValues: [String!]!
    featuredAsset: CatalogMediaRef
  }

  type CatalogQuantityRules {
    enabled: Boolean!
    min: Int!
    step: Int!
  }

  type CatalogCustomAttribute {
    name: String!
    value: String!
  }

  type CatalogProductSettings {
    nameInDelivery: String
    isFragile: Boolean!
    allowParcelOpening: Boolean!
    allowOutOfStockOrders: Boolean!
    soldOut: Boolean!
    quantityRules: CatalogQuantityRules!
    orderManagerIds: [String!]!
    customAttributes: [CatalogCustomAttribute!]!
  }

  type CatalogProduct {
    id: ID!
    title: String!
    slug: String!
    description: String
    status: CatalogProductStatus!
    type: String!
    price: Int!
    oldPrice: Int
    sku: String
    barcode: String
    weight: Int
    width: Int
    height: Int
    length: Int
    featuredAsset: CatalogMediaRef
    assets: [CatalogMediaRef!]!
    brandId: String
    tagIds: [String!]!
    highlightIds: [String!]!
    collectionIds: [ID!]!
    label: String
    cardCaption: String
    metaTitle: String
    metaDescription: String
    optionGroups: [CatalogOptionGroup!]!
    variants: [CatalogVariant!]!
    settings: CatalogProductSettings!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CatalogProductList {
    items: [CatalogProduct!]!
    totalItems: Int!
  }

  type CatalogProductSaveResult {
    product: CatalogProduct!
    warnings: [String!]!
  }

  type CatalogSlugAvailability {
    available: Boolean!
    slug: String!
  }

  input CatalogProductListInput {
    tab: String
    q: String
    collectionId: ID
    brandId: String
    tagId: String
    skip: Int
    take: Int
  }

  input CatalogOptionGroupInput {
    name: String!
    values: [String!]!
  }

  input CatalogSeoInput {
    metaTitle: String
    metaDescription: String
  }

  input CatalogQuantityRulesInput {
    enabled: Boolean
    min: Int
    step: Int
  }

  input CatalogCustomAttributeInput {
    name: String!
    value: String!
  }

  input CatalogProductSettingsInput {
    nameInDelivery: String
    isFragile: Boolean
    allowParcelOpening: Boolean
    allowOutOfStockOrders: Boolean
    soldOut: Boolean
    quantityRules: CatalogQuantityRulesInput
    orderManagerIds: [String!]
    customAttributes: [CatalogCustomAttributeInput!]
  }

  input CreateCatalogProductInput {
    title: String!
    slug: String
    description: String
    status: CatalogProductStatus!
    type: String
    price: Int!
    oldPrice: Int
    sku: String
    barcode: String
    weight: Int
    width: Int
    height: Int
    length: Int
    featuredAssetId: ID
    assetIds: [ID!]
    brandId: String
    tagIds: [String!]
    highlightIds: [String!]
    collectionIds: [ID!]
    label: String
    cardCaption: String
    seo: CatalogSeoInput
    optionGroups: [CatalogOptionGroupInput!]
    settings: CatalogProductSettingsInput
  }

  input CatalogVariantInput {
    id: ID!
    price: Int
    oldPrice: Int
    sku: String
    barcode: String
    isHidden: Boolean
    featuredAssetId: ID
  }

  input UpdateCatalogProductInput {
    title: String
    slug: String
    description: String
    status: CatalogProductStatus
    type: String
    price: Int
    oldPrice: Int
    sku: String
    barcode: String
    weight: Int
    width: Int
    height: Int
    length: Int
    featuredAssetId: ID
    assetIds: [ID!]
    brandId: String
    tagIds: [String!]
    highlightIds: [String!]
    collectionIds: [ID!]
    label: String
    cardCaption: String
    seo: CatalogSeoInput
    optionGroups: [CatalogOptionGroupInput!]
    settings: CatalogProductSettingsInput
    variants: [CatalogVariantInput!]
  }

  extend type Query {
    catalogProducts(options: CatalogProductListInput): CatalogProductList!
    catalogProduct(id: ID!): CatalogProduct
    catalogSlugAvailability(slug: String!, productId: ID): CatalogSlugAvailability!
  }

  extend type Mutation {
    createCatalogProduct(input: CreateCatalogProductInput!): CatalogProductSaveResult!
    updateCatalogProduct(id: ID!, input: UpdateCatalogProductInput!): CatalogProductSaveResult!
    setCatalogProductStatus(id: ID!, status: CatalogProductStatus!): CatalogProduct!
    deleteCatalogProduct(id: ID!): Boolean!
  }
`;
