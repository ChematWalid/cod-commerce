import { type IsolationCase, ownerGraphql } from '../matrix';

/** A valid CreateChannelInput (Vendure 3.8.1), so the request reaches the permission check and not validation. */
const CHANNEL_INPUT = {
  code: 'intruder',
  defaultLanguageCode: 'en',
  pricesIncludeTax: true,
  defaultCurrencyCode: 'USD',
  defaultTaxZoneId: '1',
  defaultShippingZoneId: '1',
};

/** The id of Vendure's first row of a table: the default channel, the SuperAdmin role. */
const FIRST_ID = '1';

/**
 * Vendure's own Admin API writes (stock Vendure data). An owner holds no stock permission, so every one is
 * FORBIDDEN on A's own store, whatever id it names; the shadowed `updateActiveAdministrator` refuses an email change.
 */
export const STOCK_WRITE_CASES: readonly IsolationCase[] = [
  {
    id: 'stock.create-channel',
    entity: 'stock Vendure data',
    endpoint: 'createChannel',
    access: 'write',
    title: "A's owner creates a stock channel carrying B's store token: FORBIDDEN",
    request: (a, b) =>
      ownerGraphql(a, 'mutation ($input: CreateChannelInput!) { createChannel(input: $input) { __typename } }', {
        input: { ...CHANNEL_INPUT, token: b.stores[0].channelToken },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.update-channel',
    entity: 'stock Vendure data',
    endpoint: 'updateChannel',
    access: 'write',
    title: "A's owner renames the default stock channel: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: UpdateChannelInput!) { updateChannel(input: $input) { __typename } }', {
        input: { id: FIRST_ID, code: 'intruder' },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.create-role',
    entity: 'stock Vendure data',
    endpoint: 'createRole',
    access: 'write',
    title: "A's owner creates a stock SuperAdmin role: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: CreateRoleInput!) { createRole(input: $input) { id } }', {
        input: { code: 'intruder', description: 'intruder', permissions: ['SuperAdmin'] },
      }),
    expect: { kind: 'forbidden' },
    reverse: true,
  },
  {
    id: 'stock.update-role',
    entity: 'stock Vendure data',
    endpoint: 'updateRole',
    access: 'write',
    title: "A's owner edits the stock SuperAdmin role: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: UpdateRoleInput!) { updateRole(input: $input) { id } }', {
        input: { id: FIRST_ID, description: 'intruder' },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.delete-role',
    entity: 'stock Vendure data',
    endpoint: 'deleteRole',
    access: 'write',
    title: "A's owner deletes a stock role: FORBIDDEN",
    request: (a) => ownerGraphql(a, 'mutation ($id: ID!) { deleteRole(id: $id) { result } }', { id: FIRST_ID }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.create-administrator',
    entity: 'stock Vendure data',
    endpoint: 'createAdministrator',
    access: 'write',
    title: "A's owner creates a stock administrator: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: CreateAdministratorInput!) { createAdministrator(input: $input) { id } }', {
        input: {
          firstName: 'Intruder',
          lastName: a.label,
          emailAddress: `intruder-${a.label.toLowerCase()}@example.test`,
          password: 'intruder-password',
          roleIds: [],
        },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.update-administrator',
    entity: 'stock Vendure data',
    endpoint: 'updateAdministrator',
    access: 'write',
    title: "A's owner renames B's owner through the stock updateAdministrator: FORBIDDEN, B's owner unchanged",
    request: (a, b) =>
      ownerGraphql(a, 'mutation ($input: UpdateAdministratorInput!) { updateAdministrator(input: $input) { id } }', {
        input: { id: b.owner.administratorId, lastName: 'Taken over' },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.assign-role',
    entity: 'stock Vendure data',
    endpoint: 'assignRoleToAdministrator',
    access: 'write',
    title: "A's owner gives B's owner the stock SuperAdmin role: FORBIDDEN",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($administratorId: ID!, $roleId: ID!) { assignRoleToAdministrator(administratorId: $administratorId, roleId: $roleId) { id } }',
        { administratorId: b.owner.administratorId, roleId: FIRST_ID },
      ),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.update-active-administrator-email',
    entity: 'account',
    endpoint: 'updateActiveAdministrator(input.emailAddress)',
    access: 'write',
    title: "A's owner takes B's owner email through the stock profile save: auth.use-account-security",
    request: (a, b) =>
      ownerGraphql(
        a,
        'mutation ($input: UpdateActiveAdministratorInput!) { updateActiveAdministrator(input: $input) { id } }',
        { input: { emailAddress: b.owner.email } },
      ),
    expect: { kind: 'code', code: 'auth.use-account-security' },
  },
  {
    id: 'stock.create-api-key',
    entity: 'stock Vendure data',
    endpoint: 'createApiKey',
    access: 'write',
    title: "A's owner creates a stock API key: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: CreateApiKeyInput!) { createApiKey(input: $input) { apiKey entityId } }', {
        input: { roleIds: [], translations: [{ languageCode: 'en', name: 'intruder' }] },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.delete-api-keys',
    entity: 'stock Vendure data',
    endpoint: 'deleteApiKeys',
    access: 'write',
    title: "A's owner deletes stock API keys: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($ids: [ID!]!) { deleteApiKeys(ids: $ids) { result } }', { ids: [FIRST_ID] }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.create-seller',
    entity: 'stock Vendure data',
    endpoint: 'createSeller',
    access: 'write',
    title: "A's owner creates a stock seller: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: CreateSellerInput!) { createSeller(input: $input) { id } }', {
        input: { name: 'Intruder' },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.create-customer',
    entity: 'stock Vendure data',
    endpoint: 'createCustomer',
    access: 'write',
    title: "A's owner creates a stock customer: FORBIDDEN",
    request: (a) =>
      ownerGraphql(a, 'mutation ($input: CreateCustomerInput!) { createCustomer(input: $input) { __typename } }', {
        input: {
          firstName: 'Intruder',
          lastName: a.label,
          emailAddress: `intruder-customer-${a.label.toLowerCase()}@example.test`,
        },
      }),
    expect: { kind: 'forbidden' },
  },
  {
    id: 'stock.update-global-settings',
    entity: 'stock Vendure data',
    endpoint: 'updateGlobalSettings',
    access: 'write',
    title: "A's owner changes the platform's global settings: FORBIDDEN",
    request: (a) =>
      ownerGraphql(
        a,
        'mutation ($input: UpdateGlobalSettingsInput!) { updateGlobalSettings(input: $input) { __typename } }',
        { input: { outOfStockThreshold: 0 } },
      ),
    expect: { kind: 'forbidden' },
  },
];
