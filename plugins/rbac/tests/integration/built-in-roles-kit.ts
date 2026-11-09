import gql from 'graphql-tag';

export const PROVISION_BUSINESS = gql`
  mutation ($input: ProvisionBusinessInput!) {
    provisionBusiness(input: $input) {
      business {
        id
      }
    }
  }
`;

export const CREATE_STORE = gql`
  mutation ($input: CreateStoreInput!) {
    createStore(input: $input) {
      id
      channelToken
      subdomain
    }
  }
`;

export const CANCEL_ORDER = gql`
  mutation {
    rbacTestCancelOrder
  }
`;

export const STOCK_ADMINISTRATORS = gql`
  query {
    administrators {
      totalItems
    }
  }
`;

const CHANNEL_INPUT = `{
  code: "x", token: "x", defaultLanguageCode: en, pricesIncludeTax: true, defaultCurrencyCode: USD,
  defaultTaxZoneId: "1", defaultShippingZoneId: "1"
}`;

/** The stock operations a merchant must never reach, each with arguments valid enough to reach the permission check. */
export const FORBIDDEN_STOCK_OPERATIONS = {
  createRole: `mutation { createRole(input: { code: "x", description: "x", permissions: [Authenticated] }) { id } }`,
  updateRole: `mutation { updateRole(input: { id: "1" }) { id } }`,
  deleteRole: `mutation { deleteRole(id: "1") { result } }`,
  roles: `query { roles { totalItems } }`,
  administrators: `query { administrators { totalItems } }`,
  createAdministrator: `mutation {
    createAdministrator(input: {
      firstName: "x", lastName: "x", emailAddress: "x@example.test", password: "x", roleIds: []
    }) { id }
  }`,
  updateAdministrator: `mutation { updateAdministrator(input: { id: "1" }) { id } }`,
  assignRoleToAdministrator: `mutation { assignRoleToAdministrator(administratorId: "1", roleId: "1") { id } }`,
  channels: `query { channels { totalItems } }`,
  createChannel: `mutation { createChannel(input: ${CHANNEL_INPUT}) { __typename } }`,
  updateChannel: `mutation { updateChannel(input: { id: "1" }) { __typename } }`,
  createSeller: `mutation { createSeller(input: { name: "x" }) { id } }`,
  updateGlobalSettings: `mutation { updateGlobalSettings(input: {}) { __typename } }`,
} as const;
