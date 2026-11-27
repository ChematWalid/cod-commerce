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

  extend type Query {
    deliveryFeeGroups(options: DeliveryFeeGroupListInput): DeliveryFeeGroupPage!
    deliveryFeeGroup(id: String!): DeliveryFeeGroup
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
  }
`;
