import gql from 'graphql-tag';

/**
 * The pack Admin API (D2206): names prefixed `CatalogPack`; Vendure product and variant ids are `ID`. The enum values
 * are the shared `PACK_*_MODES` words (D2202).
 */
export const packsAdminApiSchema = gql`
  enum CatalogPackPricingMode {
    fixed
    components_sum
  }

  enum CatalogPackDiscountType {
    percent
    amount
  }

  enum CatalogPackVariantMode {
    per_component
    shared_option
  }

  enum CatalogPackWeightMode {
    components_sum
    fixed
  }

  enum CatalogPackStatus {
    ok
    stale
  }

  type CatalogPackComponent {
    productId: ID!
    variantId: ID
    quantity: Int!
  }

  type CatalogPack {
    productId: ID!
    status: CatalogPackStatus!
    packPricingMode: CatalogPackPricingMode!
    packFixedPrice: Int
    packDiscountType: CatalogPackDiscountType
    packDiscountValue: Int
    packVariantMode: CatalogPackVariantMode!
    packSharedOption: String
    packWeightMode: CatalogPackWeightMode!
    packFixedWeightGrams: Int
    components: [CatalogPackComponent!]!
    "The price stored on the pack product (its default variant), in whole DZD."
    price: Int!
    weightGrams: Int
  }

  type CatalogPackSharedValue {
    value: String!
    price: Int!
  }

  type CatalogPackPreview {
    price: Int!
    weightGrams: Int!
    sharedValues: [CatalogPackSharedValue!]!
  }

  input CatalogPackComponentInput {
    productId: ID!
    variantId: ID
    quantity: Int!
  }

  input CatalogPackInput {
    packPricingMode: CatalogPackPricingMode!
    packFixedPrice: Int
    packDiscountType: CatalogPackDiscountType
    packDiscountValue: Int
    packVariantMode: CatalogPackVariantMode!
    packSharedOption: String
    packWeightMode: CatalogPackWeightMode!
    packFixedWeightGrams: Int
    components: [CatalogPackComponentInput!]!
  }

  extend type Query {
    catalogPack(productId: ID!): CatalogPack
  }

  extend type Mutation {
    saveCatalogPack(productId: ID!, input: CatalogPackInput!): CatalogPack!
    previewCatalogPack(input: CatalogPackInput!): CatalogPackPreview!
  }
`;
