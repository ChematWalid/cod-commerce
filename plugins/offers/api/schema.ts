import gql from 'graphql-tag';

/**
 * The offers' Admin API (D2519). Every name starts with `Offer` so none collides with Vendure's own API. Offer and
 * code ids are snowflakes and target ids the stored decimal core ids, both `String` (D2535). The JSON-shaped fields
 * (`label`, `config`, `combinesWith`, `eligibility`, a preview's quote) are `JSON`, checked by the shared schemas.
 * Instants are ISO text on input and `DateTime` on output. A performance's DZD sums are `Float`: each order total fits
 * a 32-bit `Int`, their sum over every order does not, and a `Float` holds whole DZD exactly up to 2^53 (D2535(j)).
 */
export const offersAdminApiSchema = gql`
  enum OfferStatus {
    draft
    active
    paused
    archived
  }

  enum OfferMove {
    publish
    pause
    resume
    archive
  }

  enum OfferMethod {
    automatic
    codes
  }

  type OfferTarget {
    role: String!
    refType: String!
    refId: String!
  }

  type OfferPerformance {
    orders: Int!
    deliveredRevenue: Float!
    discountGiven: Float!
  }

  type OfferView {
    id: String!
    kind: String!
    method: OfferMethod!
    title: String!
    label: JSON!
    config: JSON
    combinesWith: JSON!
    eligibility: JSON!
    totalUsageLimit: Int
    perBuyerLimit: Int
    status: OfferStatus!
    startsAt: DateTime
    endsAt: DateTime
    publishedAt: DateTime
    pausedAt: DateTime
    archivedAt: DateTime
    usageCount: Int!
    version: Int!
    targets: [OfferTarget!]!
    codeCount: Int!
    performance: OfferPerformance!
    allowedMoves: [OfferMove!]!
    editable: Boolean!
    deletable: Boolean!
  }

  type OfferPage {
    items: [OfferView!]!
    totalItems: Int!
  }

  type OfferCodeView {
    id: String!
    offerId: String!
    code: String!
    usageLimit: Int
    usageCount: Int!
    createdAt: DateTime!
  }

  type OfferAppType {
    id: String!
    kind: String!
    method: OfferMethod!
    goal: String
    recommended: Boolean!
  }

  type OfferPreviewScenario {
    pieces: Int!
    addonAccepted: Boolean!
    quote: JSON!
  }

  type OfferPreview {
    scenarios: [OfferPreviewScenario!]!
    warnings: [String!]!
  }

  input OfferListInput {
    status: OfferStatus
    kind: String
    productId: String
    skip: Int
    take: Int
  }

  input OfferTargetInput {
    role: String
    refType: String!
    refId: String!
  }

  input CreateOfferInput {
    kind: String!
    method: OfferMethod
    title: String!
    label: JSON
    config: JSON
    combinesWith: JSON
    eligibility: JSON
    totalUsageLimit: Int
    perBuyerLimit: Int
    startsAt: String
    endsAt: String
    targets: [OfferTargetInput!]
  }

  input UpdateOfferInput {
    kind: String
    method: OfferMethod
    title: String
    label: JSON
    config: JSON
    combinesWith: JSON
    eligibility: JSON
    totalUsageLimit: Int
    perBuyerLimit: Int
    startsAt: String
    endsAt: String
    targets: [OfferTargetInput!]
  }

  input OfferCodeInput {
    code: String!
    usageLimit: Int
  }

  input GenerateOfferCodesInput {
    count: Int!
    prefix: String
    usageLimit: Int
  }

  input OfferPreviewInput {
    offer: CreateOfferInput!
    samplePrice: Int
    sampleDeliveryFee: Int
  }

  extend type Query {
    offers(options: OfferListInput): OfferPage!
    offer(id: String!): OfferView
    offerCodes(offerId: String!): [OfferCodeView!]!
    offerStats(id: String!): OfferPerformance!
    offerAppTypes: [OfferAppType!]!
    previewOffer(input: OfferPreviewInput!): OfferPreview!
  }

  extend type Mutation {
    createOffer(input: CreateOfferInput!): OfferView!
    updateOffer(id: String!, input: UpdateOfferInput!, version: Int): OfferView!
    publishOffer(id: String!): OfferView!
    pauseOffer(id: String!): OfferView!
    resumeOffer(id: String!): OfferView!
    archiveOffer(id: String!): OfferView!
    duplicateOffer(id: String!): OfferView!
    deleteOffer(id: String!): Boolean!
    addOfferCodes(offerId: String!, codes: [OfferCodeInput!]!): [OfferCodeView!]!
    generateOfferCodes(offerId: String!, input: GenerateOfferCodesInput!): [OfferCodeView!]!
    removeOfferCode(offerId: String!, code: String!): Boolean!
  }
`;
