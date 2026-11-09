import gql from 'graphql-tag';

/** The tenancy Admin API. Our ids are `String` (D1); `ID` is only for the engine's own entities, such as assets. */
export const adminApiSchema = gql`
  enum SoldOutBehavior {
    keep
    hide
  }

  enum SubdomainStatus {
    available
    taken
    reserved
    invalid
  }

  type Business {
    id: String!
    name: String!
    logoAssetId: ID
    status: String!
  }

  type Store {
    id: String!
    businessId: String!
    channelToken: String!
    name: String!
    description: String!
    logoAssetId: ID
    language: String!
    subdomain: String!
    defaultDeliveryFeeGroupId: String
    defaultCarrierId: String
    showAddressField: Boolean!
    soldOutBehavior: SoldOutBehavior!
    status: String!
  }

  type SubdomainAvailability {
    subdomain: String!
    status: SubdomainStatus!
    reason: String
    reasonCode: String
  }

  type ProvisionBusinessResult {
    business: Business!
    store: Store!
    administratorId: ID!
  }

  input ProvisionBusinessOwnerInput {
    emailAddress: String!
    firstName: String!
    lastName: String!
    password: String!
  }

  input CreateStoreInput {
    name: String!
    subdomain: String!
    language: String!
    description: String
    logoAssetId: ID
  }

  input ProvisionBusinessInput {
    name: String!
    owner: ProvisionBusinessOwnerInput!
    store: CreateStoreInput!
  }

  input UpdateBusinessInput {
    name: String
    logoAssetId: ID
  }

  input UpdateStoreInput {
    name: String
    description: String
    logoAssetId: ID
    language: String
    defaultDeliveryFeeGroupId: String
    defaultCarrierId: String
    showAddressField: Boolean
    soldOutBehavior: SoldOutBehavior
  }

  extend type Query {
    activeBusiness: Business!
    business(id: String!): Business
    stores: [Store!]!
    store(id: String!): Store
    subdomainAvailability(subdomain: String!): SubdomainAvailability!
  }

  extend type Mutation {
    provisionBusiness(input: ProvisionBusinessInput!): ProvisionBusinessResult!
    updateBusiness(input: UpdateBusinessInput!): Business!
    createStore(input: CreateStoreInput!): Store!
    updateStore(id: String!, input: UpdateStoreInput!): Store!
    archiveStore(id: String!): Store!
    changeStoreSubdomain(id: String!, subdomain: String!): Store!
  }
`;
