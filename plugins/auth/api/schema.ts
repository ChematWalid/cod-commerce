import gql from 'graphql-tag';

/** The registration and public configuration part of the auth Admin API. */
export const authAdminApiSchema = gql`
  input RegisterMerchantInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    businessName: String!
    storeName: String!
    subdomain: String!
    storeLanguage: String!
    emailLocale: String!
    challengeToken: String
    oauthTicket: String
  }

  type RegisterMerchantResult {
    businessId: String!
    storeId: String!
    verificationEmailSent: Boolean!
  }

  type AuthPublicConfig {
    oauthEnabled: Boolean!
    oauthProviders: [String!]!
    challengeUrl: String
  }

  extend type Query {
    authPublicConfig: AuthPublicConfig!
  }

  extend type Mutation {
    registerMerchant(input: RegisterMerchantInput!): RegisterMerchantResult!
  }
`;
