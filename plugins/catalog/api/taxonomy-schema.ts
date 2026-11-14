import gql from 'graphql-tag';

/**
 * Brands, tags and highlights of the active store (D2101 prefixes). Their ids are our snowflakes, so `String` (D1);
 * reads need `catalog.products.view`, writes `catalog.products.edit` (no new keys).
 */
export const taxonomyAdminApiSchema = gql`
  type CatalogBrand {
    id: String!
    name: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CatalogTag {
    id: String!
    name: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type CatalogHighlight {
    id: String!
    text: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  input CatalogBrandInput {
    name: String!
  }

  input CatalogTagInput {
    name: String!
  }

  input CatalogHighlightInput {
    text: String!
  }

  extend type Query {
    catalogBrands: [CatalogBrand!]!
    catalogTags: [CatalogTag!]!
    catalogHighlights: [CatalogHighlight!]!
  }

  extend type Mutation {
    createCatalogBrand(input: CatalogBrandInput!): CatalogBrand!
    updateCatalogBrand(id: String!, input: CatalogBrandInput!): CatalogBrand!
    deleteCatalogBrand(id: String!): Boolean!
    createCatalogTag(input: CatalogTagInput!): CatalogTag!
    updateCatalogTag(id: String!, input: CatalogTagInput!): CatalogTag!
    deleteCatalogTag(id: String!): Boolean!
    createCatalogHighlight(input: CatalogHighlightInput!): CatalogHighlight!
    updateCatalogHighlight(id: String!, input: CatalogHighlightInput!): CatalogHighlight!
    deleteCatalogHighlight(id: String!): Boolean!
  }
`;
