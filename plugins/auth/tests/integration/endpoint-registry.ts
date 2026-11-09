/** Who may call a handler: anyone, any signed-in administrator (`Owner`), or one who may update the business. */
export type Access = 'public' | 'owner' | 'business-update';

/** One GraphQL operation of the plugin, with a call that is valid in shape and carries nothing real. */
export interface OperationEntry {
  readonly api: 'admin' | 'shop';
  readonly operation: string;
  readonly access: Access;
  readonly document: string;
  readonly variables: Readonly<Record<string, unknown>>;
}

/** One REST route of the plugin, with a call that is valid in shape. */
export interface RouteEntry {
  readonly method: 'GET' | 'POST' | 'PATCH';
  /** The route as the controllers declare it. */
  readonly route: string;
  readonly access: Access;
  /** The route with its parameters filled. */
  readonly url: string;
  readonly body?: Readonly<Record<string, unknown>>;
}

const PASSWORD_VARIABLES = { currentPassword: 'synthetic-current', newPassword: 'synthetic-next-password' };
const TOKEN_VARIABLES = { token: 'synthetic-token' };
const ADMIN = 'admin';
const SHOP = 'shop';

/** Every GraphQL operation the plugin's resolvers declare, on the Admin and the Shop API. */
export const OPERATION_REGISTRY: readonly OperationEntry[] = [
  {
    api: ADMIN,
    operation: 'authPublicConfig',
    access: 'public',
    document: 'query { authPublicConfig { oauthEnabled } }',
    variables: {},
  },
  {
    api: ADMIN,
    operation: 'accountStatus',
    access: 'owner',
    document: 'query { accountStatus { emailVerified } }',
    variables: {},
  },
  {
    api: ADMIN,
    operation: 'accountProfile',
    access: 'owner',
    document: 'query { accountProfile { emailAddress } }',
    variables: {},
  },
  {
    api: ADMIN,
    operation: 'registerMerchant',
    access: 'public',
    document: 'mutation ($input: RegisterMerchantInput!) { registerMerchant(input: $input) { businessId } }',
    variables: {
      input: {
        email: 'nobody@example.test',
        password: 'synthetic-owner-password',
        firstName: 'N',
        lastName: 'O',
        businessName: 'None',
        storeName: 'None',
        subdomain: 'none',
        storeLanguage: 'ar',
        emailLocale: 'ar',
      },
    },
  },
  {
    api: ADMIN,
    operation: 'verifyEmail',
    access: 'public',
    document: 'mutation ($token: String!) { verifyEmail(token: $token) { success } }',
    variables: TOKEN_VARIABLES,
  },
  {
    api: ADMIN,
    operation: 'verifyEmailOtp',
    access: 'owner',
    document: 'mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }',
    variables: { code: '000000' },
  },
  {
    api: ADMIN,
    operation: 'resendEmailVerification',
    access: 'owner',
    document: 'mutation { resendEmailVerification { sentAt } }',
    variables: {},
  },
  {
    api: ADMIN,
    operation: 'changeAccountPassword',
    access: 'owner',
    document:
      'mutation ($currentPassword: String!, $newPassword: String!) { changeAccountPassword(currentPassword: $currentPassword, newPassword: $newPassword) { success } }',
    variables: PASSWORD_VARIABLES,
  },
  {
    api: ADMIN,
    operation: 'requestEmailChange',
    access: 'owner',
    document:
      'mutation ($newEmail: String!, $currentPassword: String!) { requestEmailChange(newEmail: $newEmail, currentPassword: $currentPassword) { success } }',
    variables: { newEmail: 'nobody@example.test', currentPassword: 'synthetic-current' },
  },
  {
    api: ADMIN,
    operation: 'confirmEmailChange',
    access: 'public',
    document: 'mutation ($token: String!) { confirmEmailChange(token: $token) { success } }',
    variables: TOKEN_VARIABLES,
  },
  {
    api: ADMIN,
    operation: 'updateAccountProfile',
    access: 'owner',
    document: 'mutation ($input: UpdateAccountProfileInput!) { updateAccountProfile(input: $input) { emailAddress } }',
    variables: { input: { firstName: 'Nobody' } },
  },
  {
    api: ADMIN,
    operation: 'uploadBusinessLogo',
    access: 'business-update',
    document: 'mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }',
    variables: {},
  },
  { api: ADMIN, operation: 'logout', access: 'public', document: 'mutation { logout { success } }', variables: {} },
  {
    api: ADMIN,
    operation: 'requestPasswordReset',
    access: 'public',
    document:
      'mutation ($emailAddress: String!) { requestPasswordReset(emailAddress: $emailAddress) { ... on Success { success } } }',
    variables: { emailAddress: 'nobody@example.test' },
  },
  {
    api: ADMIN,
    operation: 'resetPassword',
    access: 'public',
    document:
      'mutation ($token: String!, $password: String!) { resetPassword(token: $token, password: $password) { __typename } }',
    variables: { token: 'synthetic-token', password: 'synthetic-next-password' },
  },
  {
    api: ADMIN,
    operation: 'updateActiveAdministrator',
    access: 'owner',
    document: 'mutation ($input: UpdateActiveAdministratorInput!) { updateActiveAdministrator(input: $input) { id } }',
    variables: { input: { firstName: 'Nobody' } },
  },
  { api: SHOP, operation: 'logout', access: 'public', document: 'mutation { logout { success } }', variables: {} },
  {
    api: SHOP,
    operation: 'requestPasswordReset',
    access: 'public',
    document:
      'mutation ($emailAddress: String!) { requestPasswordReset(emailAddress: $emailAddress) { ... on Success { success } } }',
    variables: { emailAddress: 'nobody@example.test' },
  },
  {
    api: SHOP,
    operation: 'updateCustomerPassword',
    access: 'owner',
    document:
      'mutation ($currentPassword: String!, $newPassword: String!) { updateCustomerPassword(currentPassword: $currentPassword, newPassword: $newPassword) { __typename } }',
    variables: PASSWORD_VARIABLES,
  },
];

const OAUTH_START = '/auth/oauth/:provider/start';

/** Every REST route the plugin's controllers declare. */
export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  { method: 'GET', route: '/auth/config', access: 'public', url: '/auth/config' },
  {
    method: 'POST',
    route: '/auth/login',
    access: 'public',
    url: '/auth/login',
    body: { email: 'a@example.test', password: 'x' },
  },
  { method: 'POST', route: '/auth/logout', access: 'public', url: '/auth/logout', body: {} },
  { method: 'POST', route: '/auth/register', access: 'public', url: '/auth/register', body: {} },
  { method: 'POST', route: '/auth/verify-email/:token', access: 'public', url: '/auth/verify-email/synthetic-token' },
  {
    method: 'POST',
    route: '/auth/verify-email-otp',
    access: 'owner',
    url: '/auth/verify-email-otp',
    body: { code: '000000' },
  },
  {
    method: 'POST',
    route: '/auth/change-email-request',
    access: 'owner',
    url: '/auth/change-email-request',
    body: { newEmail: 'nobody@example.test', currentPassword: 'synthetic-current' },
  },
  {
    method: 'POST',
    route: '/auth/confirm-email-change',
    access: 'public',
    url: '/auth/confirm-email-change',
    body: TOKEN_VARIABLES,
  },
  {
    method: 'POST',
    route: '/auth/forgot-password',
    access: 'public',
    url: '/auth/forgot-password',
    body: { email: 'nobody@example.test' },
  },
  {
    method: 'POST',
    route: '/auth/reset-password',
    access: 'public',
    url: '/auth/reset-password',
    body: { token: 'synthetic-token', password: 'synthetic-next-password' },
  },
  {
    method: 'POST',
    route: '/auth/change-password',
    access: 'owner',
    url: '/auth/change-password',
    body: PASSWORD_VARIABLES,
  },
  { method: 'GET', route: '/auth/profile', access: 'owner', url: '/auth/profile' },
  { method: 'PATCH', route: '/auth/profile', access: 'owner', url: '/auth/profile', body: { firstName: 'Nobody' } },
  { method: 'GET', route: OAUTH_START, access: 'public', url: '/auth/oauth/google/start' },
  { method: 'GET', route: '/auth/oauth/:provider/callback', access: 'public', url: '/auth/oauth/google/callback' },
  { method: 'POST', route: '/auth/oauth/ticket', access: 'public', url: '/auth/oauth/ticket', body: TOKEN_VARIABLES },
];

/** The entries a signed-out caller must be refused. */
export const GUARDED_OPERATIONS = OPERATION_REGISTRY.filter((entry) => entry.access !== 'public');
export const GUARDED_ROUTES = ROUTE_REGISTRY.filter((entry) => entry.access !== 'public');

export const operationKey = (entry: OperationEntry): string => `${entry.api}:${entry.operation}`;
export const routeKey = (entry: RouteEntry): string => `${entry.method} ${entry.route}`;
