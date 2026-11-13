/**
 * Admin API operations that any signed-in administrator (or anyone) may call without a tenant guard, each reviewed
 * for what it reads (D500). Adding one means checking that it reads no tenant table, or reads only the caller's
 * own rows, and writing down why. Reviewed 2026-11-12 against Vendure 3.8.1, with a live two-business probe.
 */
const OWN_ACCOUNT = "acts on the caller's own user only (ctx.activeUserId), never on an id from the input";
const TOKEN_BEARER =
  'acts on the owner of a mailed token; holding the link proves the mailbox (two-business.tokens tests)';

export const REVIEWED_OPEN_OPERATIONS: Readonly<Record<string, string>> = {
  accountProfile: OWN_ACCOUNT,
  updateAccountProfile: OWN_ACCOUNT,
  accountStatus: OWN_ACCOUNT,
  changeAccountPassword: OWN_ACCOUNT,
  requestEmailChange: `${OWN_ACCOUNT}; answers the same for a free and a taken address`,
  resendEmailVerification: OWN_ACCOUNT,
  verifyEmailOtp: OWN_ACCOUNT,
  activeAdministrator: OWN_ACCOUNT,
  updateActiveAdministrator: `${OWN_ACCOUNT}; the auth plugin refuses an address change here`,
  setActiveAdministratorAvatar: `${OWN_ACCOUNT}; the photo is a system asset on no channel`,
  me: "the caller's user and the channels it holds a role on, whatever channel token is sent",
  confirmEmailChange: TOKEN_BEARER,
  verifyEmail: TOKEN_BEARER,
  resetPassword: TOKEN_BEARER,
  login: 'starts a session for the given credentials; the same answer for an unknown address',
  authenticate: 'starts a session for the given credentials; the same answer for an unknown address',
  logout: "ends the caller's own session",
  requestPasswordReset: 'always answers success; the mail goes to the address owner only',
  registerMerchant: 'creates a new business; says only that an address or subdomain is taken (D27)',
  authPublicConfig: 'deployment settings (OAuth providers, Turnstile); no tenant data',
  subdomainAvailability: 'public by design: a subdomain is a public host name; rate-limited',
  switchableStores: "the caller's business's active stores on which the session holds a role (switchable-stores tests)",
  activeChannel: "Vendure checks Authenticated on the request's channel, so another business's token is FORBIDDEN",
  globalSettings: 'platform-wide settings (languages, server config); no business data',
  entityDuplicators: 'the static list of duplicators and the permissions they need',
  duplicateEntity:
    "checks the duplicator's stock permission, which no merchant role holds, before reading anything, then the channel",
  getSettingsStoreValue: 'no settings-store field is registered, so there is nothing to read',
  getSettingsStoreValues: 'no settings-store field is registered, so there is nothing to read',
  setSettingsStoreValue: 'no settings-store field is registered, so there is nothing to write',
  setSettingsStoreValues: 'no settings-store field is registered, so there is nothing to write',
};
