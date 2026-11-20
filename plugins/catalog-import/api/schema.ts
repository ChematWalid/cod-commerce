import gql from 'graphql-tag';

/**
 * The catalog-import Admin API (D2206): names prefixed `Catalog`. Product ids are Vendure's (`ID`); brand and tag ids
 * are our snowflakes (`String`), as in catalog's own schema. Each later task appends its operations; import from Task 9.
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

  input CatalogImportUploadInput {
    format: CatalogSpreadsheetFormat!
    "The file's exact size in bytes; it is signed into the upload."
    size: Int!
    "The format's own content type (catalogImportFormats), never the browser's guess."
    contentType: String!
  }

  type CatalogSignedHeader {
    name: String!
    value: String!
  }

  "A presigned PUT: send the file with exactly these headers before expiresAt."
  type CatalogImportUpload {
    importId: String!
    uploadUrl: String!
    method: String!
    headers: [CatalogSignedHeader!]!
    expiresAt: DateTime!
  }

  input CatalogImportAnalyzeInput {
    importId: String!
  }

  "A column of the file: its header, the field it fills (null: ignored) and the warning id when ignored."
  type CatalogImportColumn {
    column: Int!
    header: String!
    field: String
    warning: String
  }

  type CatalogImportSummary {
    creates: Int!
    updates: Int!
    errors: Int!
    warnings: Int!
  }

  type CatalogImportResult {
    created: Int!
    updated: Int!
    failed: Int!
  }

  "A spreadsheet import (D2210); errorReportUrl is a fresh 5-minute link once done with failed rows."
  type CatalogImport {
    importId: String!
    status: String!
    format: String!
    rowCount: Int!
    progress: Int!
    headerRow: Int
    columns: [CatalogImportColumn!]!
    summary: CatalogImportSummary
    result: CatalogImportResult
    errorCode: String
    errorReportUrl: String
  }

  "One preview row: messages are message ids, never the cell text."
  type CatalogImportPreviewRow {
    rowNumber: Int!
    action: String!
    productKey: String
    name: String
    messages: [String!]!
  }

  type CatalogImportPreview {
    importId: String!
    totalItems: Int!
    skip: Int!
    take: Int!
    items: [CatalogImportPreviewRow!]!
    summary: CatalogImportSummary
  }

  input CatalogImportColumnMappingInput {
    column: Int!
    "A column key of catalogImportFields, or null to ignore the column."
    field: String
  }

  input CatalogImportPreviewInput {
    mapping: [CatalogImportColumnMappingInput!]
  }

  extend type Mutation {
    createCatalogImportUpload(input: CatalogImportUploadInput!): CatalogImportUpload!
    analyzeCatalogImport(input: CatalogImportAnalyzeInput!): CatalogImport!
    previewCatalogImport(id: String!, input: CatalogImportPreviewInput): CatalogImportPreview!
    confirmCatalogImport(id: String!): CatalogImport!
  }

  extend type Query {
    catalogImport(id: String!): CatalogImport!
    catalogImportPreview(id: String!, skip: Int, take: Int): CatalogImportPreview!
  }
`;
