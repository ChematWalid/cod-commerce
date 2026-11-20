import gql from 'graphql-tag';

/**
 * The catalog-import Admin API (D2206): names prefixed `Catalog`. Product ids are Vendure's (`ID`); brand and tag ids
 * are our snowflakes (`String`), as in catalog's own schema. Each later task appends its operations.
 */
export const importAdminApiSchema = gql`
  enum CatalogBulkPriceMode {
    percent
    amount
    fixed
  }

  "A price change: a percentage (-100..1000, rounded half-up), a signed amount or a fixed price, in whole DZD."
  input CatalogBulkPriceChangeInput {
    mode: CatalogBulkPriceMode!
    value: Float!
  }

  "What a bulk edit changes; an absent field stays, brandId null clears the brand."
  input CatalogBulkEditChangesInput {
    status: CatalogProductStatus
    brandId: String
    addTagIds: [String!]
    removeTagIds: [String!]
    collectionIds: [ID!]
    price: CatalogBulkPriceChangeInput
  }

  input CatalogBulkEditInput {
    productIds: [ID!]!
    changes: CatalogBulkEditChangesInput!
    dryRun: Boolean
  }

  "One product's outcome: the fields that changed, or the error code that refused it."
  type CatalogBulkEditProductResult {
    productId: ID!
    ok: Boolean!
    changedFields: [String!]!
    error: String
  }

  type CatalogBulkEditResult {
    results: [CatalogBulkEditProductResult!]!
  }

  extend type Mutation {
    bulkEditCatalogProducts(input: CatalogBulkEditInput!): CatalogBulkEditResult!
  }

  enum CatalogExportScope {
    selected
    filtered
  }

  enum CatalogSpreadsheetFormat {
    xlsx
    csv
  }

  "An export (D2211): selected product ids (at most 500), or every product the product list's query finds."
  input CatalogExportInput {
    scope: CatalogExportScope!
    format: CatalogSpreadsheetFormat!
    productIds: [ID!]
    query: CatalogProductListInput
    "Column keys of catalogImportFields; product_key, name and price are always written."
    fields: [String!]
  }

  "An export job; downloadUrl is a fresh 5-minute link once status is done. Ids are snowflakes (String)."
  type CatalogExport {
    exportId: String!
    status: String!
    "Percentage of the products read so far."
    progress: Int!
    rowCount: Int!
    skippedPacks: Int!
    errorCode: String
    downloadUrl: String
  }

  type CatalogImportField {
    key: String!
    required: Boolean!
  }

  type CatalogImportFormat {
    format: String!
    contentType: String!
    extension: String!
  }

  extend type Mutation {
    exportCatalogProducts(input: CatalogExportInput!): CatalogExport!
  }

  extend type Query {
    catalogExport(id: String!): CatalogExport!
    catalogImportFields: [CatalogImportField!]!
    catalogImportFormats: [CatalogImportFormat!]!
  }
`;
