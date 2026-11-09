// GraphQL documents shared by the two-business tests.
export const NEW_PASSWORD = 'synthetic-replacement-password';
export const ASSET_NOT_AVAILABLE = 'tenancy.asset-not-available';
export const SUCCESS = { success: true };
export const PROFILE = 'query { accountProfile { firstName emailAddress } }';
export const STATUS = 'query { accountStatus { emailVerified verificationRequired resendAvailableAt pendingEmail } }';
export const UPDATE_PROFILE = `mutation ($input: UpdateAccountProfileInput!) { updateAccountProfile(input: $input) { firstName } }`;
export const VERIFY = 'mutation ($token: String!) { verifyEmail(token: $token) { success } }';
export const VERIFY_OTP = 'mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }';
export const RESEND = 'mutation { resendEmailVerification { sentAt } }';
export const CONFIRM = 'mutation ($token: String!) { confirmEmailChange(token: $token) { success } }';
export const REQUEST = `mutation ($email: String!, $password: String!) {
  requestEmailChange(newEmail: $email, currentPassword: $password) { success }
}`;
export const CHANGE = `mutation ($current: String!, $next: String!) {
  changeAccountPassword(currentPassword: $current, newPassword: $next) { success }
}`;
export const FORGOT =
  'mutation ($email: String!) { requestPasswordReset(emailAddress: $email) { ... on Success { success } } }';
export const RESET = `mutation ($token: String!, $password: String!) {
  resetPassword(token: $token, password: $password) { __typename ... on CurrentUser { identifier } }
}`;
export const UPDATE_ACTIVE =
  'mutation ($input: UpdateActiveAdministratorInput!) { updateActiveAdministrator(input: $input) { id } }';
export const REGISTER = `mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId } }`;
export const UPDATE_BUSINESS =
  'mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { logoAssetId } }';
export const UPDATE_STORE = `mutation ($id: String!, $input: UpdateStoreInput!) { updateStore(id: $id, input: $input) { logoAssetId } }`;
