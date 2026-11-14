import gql from 'graphql-tag';

/**
 * The sold-out products of the active store and "Stop orders" / "Resume orders" (AC6, D2108). Product ids are
 * Vendure's (`ID`); an empty, absent or null list acts on every sold-out product of the store. Reads need
 * `catalog.products.view`, the two writes `.edit`. The list is paged (`skip`/`take`, at most `CATALOG_MAX_PAGE_SIZE`).
 */
export const soldOutAdminApiSchema = gql`
  type CatalogSoldOutProduct {
    productId: ID!
    title: String!
    allowOutOfStockOrders: Boolean!
  }

  type CatalogSoldOutProductList {
    items: [CatalogSoldOutProduct!]!
    totalItems: Int!
  }

  input CatalogSoldOutListInput {
    skip: Int
    take: Int
  }

  input CatalogSoldOutOrdersInput {
    productIds: [ID!]
  }

  extend type Query {
    catalogSoldOutProducts(options: CatalogSoldOutListInput): CatalogSoldOutProductList!
  }

  extend type Mutation {
    stopCatalogSoldOutOrders(input: CatalogSoldOutOrdersInput!): [CatalogSoldOutProduct!]!
    resumeCatalogSoldOutOrders(input: CatalogSoldOutOrdersInput!): [CatalogSoldOutProduct!]!
  }
`;
