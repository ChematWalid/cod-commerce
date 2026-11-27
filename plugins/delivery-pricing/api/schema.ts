import gql from 'graphql-tag';

/**
 * The delivery-pricing Admin API: the active store's fee groups ("pricing options", D3125). Ids are `String`
 * snowflakes, wilaya codes the two-digit `WilayaCode`, prices `Int` in whole DZD, instants ISO 8601 text. A `null`
 * commune price or switch inherits the wilaya's.
 */
export const deliveryPricingAdminApiSchema = gql`
  type DeliveryFeeRate {
    provinceCode: String!
    homePrice: Int!
    deskPrice: Int!
    baseHomePrice: Int!
    baseDeskPrice: Int!
    deliveryEnabled: Boolean!
    deskEnabled: Boolean!
    "A merchant override is stored (never inferred from price and base)."
    overridden: Boolean!
  }

  type DeliveryFeeCommuneRate {
    codeOns: Int!
    provinceCode: String!
    homePrice: Int
    deskPrice: Int
    baseHomePrice: Int
    baseDeskPrice: Int
    deliveryEnabled: Boolean
    deskEnabled: Boolean
    overridden: Boolean!
  }

  type DeliveryFeeGroup {
    id: String!
    name: String!
    carrierId: String
    chargeOverweight: Boolean!
    overweightAllowanceKg: Int!
    overweightRate: Int!
    isPlatformDefault: Boolean!
    createdAt: String!
    updatedAt: String!
    rates: [DeliveryFeeRate!]!
    communeRates: [DeliveryFeeCommuneRate!]!
  }

  type DeliveryFeeGroupSummary {
    id: String!
    name: String!
    carrierId: String
    isPlatformDefault: Boolean!
    createdAt: String!
  }

  type DeliveryFeeGroupPage {
    items: [DeliveryFeeGroupSummary!]!
    totalItems: Int!
  }

  input DeliveryFeeGroupListInput {
    search: String
    skip: Int
    take: Int
  }

  input DeliveryFeeRateInput {
    provinceCode: String!
    homePrice: Int!
    deskPrice: Int!
    deliveryEnabled: Boolean!
    deskEnabled: Boolean!
  }

  input DeliveryFeeGroupInput {
    name: String!
    carrierId: String
    chargeOverweight: Boolean!
    overweightAllowanceKg: Int!
    overweightRate: Int!
    rates: [DeliveryFeeRateInput!]!
  }

  input DeliveryFeeCommuneRateInput {
    codeOns: Int!
    homePrice: Int
    deskPrice: Int
    deliveryEnabled: Boolean
    deskEnabled: Boolean
  }

  "How Raise/lower by... moves a price (D3140): by whole DZD or by a whole percent."
  enum DeliveryFeePriceAdjustmentKind {
    amount
    percent
  }

  "Raise/lower by... (D3140): includeCommunes defaults to false."
  input DeliveryFeePriceAdjustmentInput {
    provinceCodes: [String!]!
    kind: DeliveryFeePriceAdjustmentKind!
    value: Int!
    home: Boolean!
    desk: Boolean!
    includeCommunes: Boolean
  }

  "Set price for all communes (D3140): an absent price is left as stored, a null one clears the overrides."
  input DeliveryFeeCommunePricesInput {
    homePrice: Int
    deskPrice: Int
  }

  "A pricing option as CSV (D3142): content is the file's UTF-8 text, its byte order mark included."
  type DeliveryFeeGroupCsv {
    fileName: String!
    content: String!
  }

  "What a CSV row prices (D3142)."
  enum DeliveryFeeCsvLevel {
    wilaya
    commune
  }

  "A row's effective prices and switches; a null on a commune row inherits the wilaya's."
  type DeliveryFeeCsvValues {
    homePrice: Int
    deskPrice: Int
    deliveryEnabled: Boolean
    deskEnabled: Boolean
  }

  "One row an import changes: before is null for a commune with no row yet, after is null for a row that goes."
  type DeliveryFeeCsvChange {
    level: DeliveryFeeCsvLevel!
    provinceCode: String!
    codeOns: Int
    before: DeliveryFeeCsvValues
    after: DeliveryFeeCsvValues
  }

  "One refused row: row counts records with the header as 1; issue is a stable code such as unknown-commune."
  type DeliveryFeeCsvIssue {
    row: Int!
    column: String
    issue: String!
  }

  "What a CSV import did or would do; issues are capped, totalIssues counts them all; group is set once applied."
  type DeliveryFeeCsvImportResult {
    dryRun: Boolean!
    applied: Boolean!
    rows: Int!
    changes: [DeliveryFeeCsvChange!]!
    issues: [DeliveryFeeCsvIssue!]!
    totalIssues: Int!
    group: DeliveryFeeGroup
  }

  extend type Query {
    deliveryFeeGroups(options: DeliveryFeeGroupListInput): DeliveryFeeGroupPage!
    deliveryFeeGroup(id: String!): DeliveryFeeGroup
    deliveryFeeGroupCsv(id: String!): DeliveryFeeGroupCsv
  }

  extend type Mutation {
    createDeliveryFeeGroup(input: DeliveryFeeGroupInput!): DeliveryFeeGroup!
    updateDeliveryFeeGroup(id: String!, input: DeliveryFeeGroupInput!): DeliveryFeeGroup!
    deleteDeliveryFeeGroup(id: String!): Boolean!
    setDeliveryFeeCommuneRates(
      groupId: String!
      provinceCode: String!
      rows: [DeliveryFeeCommuneRateInput!]!
    ): DeliveryFeeGroup!
    adjustDeliveryFeeGroupPrices(groupId: String!, input: DeliveryFeePriceAdjustmentInput!): DeliveryFeeGroup!
    setDeliveryFeeProvinceCommunePrices(
      groupId: String!
      provinceCode: String!
      input: DeliveryFeeCommunePricesInput!
    ): DeliveryFeeGroup!
    duplicateDeliveryFeeGroup(groupId: String!, name: String!): DeliveryFeeGroup!
    "Previews (dryRun, the default) or applies a pricing CSV (D3142)."
    importDeliveryFeeGroupCsv(groupId: String!, file: Upload!, dryRun: Boolean = true): DeliveryFeeCsvImportResult!
  }
`;
