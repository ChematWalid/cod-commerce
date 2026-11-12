/** The Admin API documents the isolation world is seeded with. */

export const PROVISION_BUSINESS = `mutation ($input: ProvisionBusinessInput!) {
  provisionBusiness(input: $input) { business { id name } store { id subdomain channelToken } }
}`;

export const CREATE_STORE = `mutation ($input: CreateStoreInput!) {
  createStore(input: $input) { id subdomain channelToken }
}`;

export const ACTIVE_ADMINISTRATOR = 'query { activeAdministrator { id } }';

export const UPDATE_PROFILE = `mutation ($input: UpdateAccountProfileInput!) {
  updateAccountProfile(input: $input) { lastName }
}`;

export const CREATE_ROLE = `mutation ($input: CreateBusinessRoleInput!) {
  createBusinessRole(input: $input) { id name }
}`;

export const SET_MEMBER_ACCESS = `mutation ($input: SetMemberAccessInput!) {
  setMemberAccess(input: $input) { administratorId }
}`;

export const SET_SECRET = `mutation ($input: SetTenantSecretInput!) {
  setTenantSecret(input: $input) { id ref }
}`;

export const CREATE_NOTE = `mutation ($input: CreateTemplateNoteInput!) {
  createTemplateNote(input: $input) { id title }
}`;

export const SET_FLAG_OVERRIDE = `mutation ($input: FeatureFlagOverrideInput!) {
  setFeatureFlagOverride(input: $input) { key }
}`;

export const STOCK_ACTIVE_CHANNEL = 'query { activeChannel { id } }';

export const STOCK_CREATE_ROLE = `mutation ($input: CreateRoleInput!) {
  createRole(input: $input) { id }
}`;

export const STOCK_CREATE_ADMINISTRATOR = `mutation ($input: CreateAdministratorInput!) {
  createAdministrator(input: $input) { id }
}`;

export const UPLOAD_LOGO = 'mutation ($file: Upload!) { uploadBusinessLogo(file: $file) { assetId } }';

/** The flag every business gets an override of, so the flag tables hold a row of each. */
export const OVERRIDDEN_FLAG = 'ai.enabled';

/** The secret the demo webhook handler signs with (registered when `PLATFORM_DEMO_HANDLERS` is on). */
export const DEMO_SECRET = { provider: 'demo-webhook', ref: 'signing' } as const;

/** The stock permissions a member's engine role carries on its one store, as `createMember` gives them. */
export const MEMBER_STOCK_PERMISSIONS = ['ReadTenantStore', 'ReadTenantBusiness'];

/** A one-pixel PNG: the smallest image the logo upload accepts. */
export const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
