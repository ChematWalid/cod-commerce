import gql from 'graphql-tag';

/**
 * The business's media library on the Admin API (D2113): media ids are our snowflakes (`String`), asset ids Vendure's
 * (`ID`). The upload is GraphQL only (multipart, D2102).
 */
export const mediaAdminApiSchema = gql`
  type CatalogMedia {
    id: String!
    assetId: ID!
    url: String!
    previewUrl: String!
    mimeType: String!
    width: Int!
    height: Int!
    fileSize: Int!
    createdAt: DateTime!
  }

  type CatalogMediaList {
    items: [CatalogMedia!]!
    totalItems: Int!
  }

  input CatalogMediaListInput {
    skip: Int
    take: Int
  }

  extend type Query {
    catalogMedia(options: CatalogMediaListInput): CatalogMediaList!
  }

  extend type Mutation {
    uploadCatalogMedia(file: Upload!): CatalogMedia!
    deleteCatalogMedia(id: String!): Boolean!
  }
`;
