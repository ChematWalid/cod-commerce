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
    platformDomain: String!
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

  type AccountProfile {
    firstName: String!
    lastName: String!
    emailAddress: String!
    "E.164, or null when none is set."
    phone: String
    "Absolute URL of the photo, set with setActiveAdministratorAvatar."
    avatarUrl: String
    emailVerified: Boolean!
  }

  "A field left out keeps its value; an empty or null phone clears it."
  input UpdateAccountProfileInput {
    firstName: String
    lastName: String
    phone: String
  }

  type UploadedLogo {
    assetId: ID!
  }

  extend type Query {
    authPublicConfig: AuthPublicConfig!
    accountStatus: AccountStatus!
    accountProfile: AccountProfile!
  }

  extend type Mutation {
    registerMerchant(input: RegisterMerchantInput!): RegisterMerchantResult!
    verifyEmail(token: String!): Success!
    verifyEmailOtp(code: String!): Success!
    resendEmailVerification: ResendResult!
    changeAccountPassword(currentPassword: String!, newPassword: String!): Success!
    requestEmailChange(newEmail: String!, currentPassword: String!): Success!
    confirmEmailChange(token: String!): Success!
    updateAccountProfile(input: UpdateAccountProfileInput!): AccountProfile!
    uploadBusinessLogo(file: Upload!): UploadedLogo!
  }
`;
