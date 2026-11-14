/** The Admin API documents the isolation world is seeded with. */

/** A store's language must be one the platform offers; a fresh database offers English only. */
export const OFFER_PLATFORM_LANGUAGES = `mutation {
  updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) { ... on GlobalSettings { id } }
}`;

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

/** The catalog documents (P2.S1) the world's catalog is seeded with. */
export const STOCK_CREATE_COLLECTION = `mutation ($input: CreateCollectionInput!) {
  createCollection(input: $input) { id }
}`;

export const CREATE_CATALOG_BRAND = `mutation ($input: CatalogBrandInput!) {
  createCatalogBrand(input: $input) { id name }
}`;

export const CREATE_CATALOG_TAG = `mutation ($input: CatalogTagInput!) {
  createCatalogTag(input: $input) { id name }
}`;

export const CREATE_CATALOG_HIGHLIGHT = `mutation ($input: CatalogHighlightInput!) {
  createCatalogHighlight(input: $input) { id text }
}`;

export const UPLOAD_CATALOG_MEDIA = 'mutation ($file: Upload!) { uploadCatalogMedia(file: $file) { id assetId } }';

export const CREATE_CATALOG_PRODUCT = `mutation ($input: CreateCatalogProductInput!) {
  createCatalogProduct(input: $input) { product { id variants { id } } }
}`;

/** The area level of the role that lets the world's member work on the catalog of its one store. */
export const CATALOG_AREA_LEVELS = [{ area: 'catalog', level: 'full' }];

/** The settings a create carries: a create takes every flag, only the lists may be left out (`productSettingsSchema`). */
export const CATALOG_SETTINGS = {
  isFragile: false,
  allowParcelOpening: true,
  allowOutOfStockOrders: true,
  soldOut: false,
  quantityRules: { enabled: false, min: 1, step: 1 },
};
