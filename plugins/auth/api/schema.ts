import gql from 'graphql-tag';

/** The auth Admin API; the shadowed stock mutations keep their stock schema (D21). */
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

  type ResendResult {
    sentAt: DateTime!
    nextAllowedAt: DateTime!
  }

  type AccountStatus {
    emailVerified: Boolean!
    verificationRequired: Boolean!
    resendAvailableAt: DateTime
    pendingEmail: String
  }

  extend type Query {
    authPublicConfig: AuthPublicConfig!
    accountStatus: AccountStatus!
  }

  extend type Mutation {
    registerMerchant(input: RegisterMerchantInput!): RegisterMerchantResult!
    verifyEmail(token: String!): Success!
    verifyEmailOtp(code: String!): Success!
    resendEmailVerification: ResendResult!
    changeAccountPassword(currentPassword: String!, newPassword: String!): Success!
    requestEmailChange(newEmail: String!, currentPassword: String!): Success!
    confirmEmailChange(token: String!): Success!
  }
`;
