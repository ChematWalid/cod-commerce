import gql from 'graphql-tag';

/**
 * The sold-out products of the active store and "Stop orders" / "Resume orders" (AC6, D2108). Product ids are
 * Vendure's (`ID`); an empty or absent list acts on every sold-out product of the store. Reads need
 * `catalog.products.view`, the two writes `.edit`.
 */
export const soldOutAdminApiSchema = gql`
  type CatalogSoldOutProduct {
    productId: ID!
    title: String!
    allowOutOfStockOrders: Boolean!
  }

  input CatalogSoldOutOrdersInput {
    productIds: [ID!]
  }

  extend type Query {
    catalogSoldOutProducts: [CatalogSoldOutProduct!]!
  }

  extend type Mutation {
    stopCatalogSoldOutOrders(input: CatalogSoldOutOrdersInput!): [CatalogSoldOutProduct!]!
    resumeCatalogSoldOutOrders(input: CatalogSoldOutOrdersInput!): [CatalogSoldOutProduct!]!
  }
`;
