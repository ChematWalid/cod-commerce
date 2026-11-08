import gql from 'graphql-tag';

/** Every `Store` field the Admin API exposes. */
export const STORE_FIELDS = gql`
  fragment StoreFields on Store {
    id
    businessId
    channelToken
    name
    description
    logoAssetId
    language
    subdomain
    defaultDeliveryFeeGroupId
    defaultCarrierId
    showAddressField
    soldOutBehavior
    status
  }
`;

/** A `Store` as the Admin API returns it. */
export interface StoreView {
  readonly id: string;
  readonly businessId: string;
  readonly channelToken: string;
  readonly name: string;
  readonly description: string;
  readonly logoAssetId: string | null;
  readonly language: string;
  readonly subdomain: string;
  readonly defaultDeliveryFeeGroupId: string | null;
  readonly defaultCarrierId: string | null;
  readonly showAddressField: boolean;
  readonly soldOutBehavior: string;
  readonly status: string;
}

/** A `Business` as the Admin API returns it. */
export interface BusinessView {
  readonly id: string;
  readonly name: string;
  readonly logoAssetId: string | null;
  readonly status: string;
}

export const ACTIVE_BUSINESS = gql`
  query {
    activeBusiness {
      id
      name
      logoAssetId
      status
    }
  }
`;

export const BUSINESS = gql`
  query ($id: String!) {
    business(id: $id) {
      id
      name
    }
  }
`;

export const UPDATE_BUSINESS = gql`
  mutation ($input: UpdateBusinessInput!) {
    updateBusiness(input: $input) {
      id
      name
      logoAssetId
      status
    }
  }
`;

export const PROVISION_BUSINESS = gql`
  mutation ($input: ProvisionBusinessInput!) {
    provisionBusiness(input: $input) {
      business {
        id
        name
      }
      store {
        id
        subdomain
      }
      administratorId
    }
  }
`;

export const STORES = gql`
  query {
    stores {
      ...StoreFields
    }
  }
  ${STORE_FIELDS}
`;

export const STORE = gql`
  query ($id: String!) {
    store(id: $id) {
      ...StoreFields
    }
  }
  ${STORE_FIELDS}
`;

export const CREATE_STORE = gql`
  mutation ($input: CreateStoreInput!) {
    createStore(input: $input) {
      ...StoreFields
    }
  }
  ${STORE_FIELDS}
`;

export const UPDATE_STORE = gql`
  mutation ($id: String!, $input: UpdateStoreInput!) {
    updateStore(id: $id, input: $input) {
      ...StoreFields
    }
  }
  ${STORE_FIELDS}
`;

export const ARCHIVE_STORE = gql`
  mutation ($id: String!) {
    archiveStore(id: $id) {
      ...StoreFields
    }
  }
  ${STORE_FIELDS}
`;

export const CHANGE_STORE_SUBDOMAIN = gql`
  mutation ($id: String!, $subdomain: String!) {
    changeStoreSubdomain(id: $id, subdomain: $subdomain) {
      ...StoreFields
    }
  }
  ${STORE_FIELDS}
`;

export const SUBDOMAIN_AVAILABILITY = gql`
  query ($subdomain: String!) {
    subdomainAvailability(subdomain: $subdomain) {
      subdomain
      status
      reason
    }
  }
`;

export const ME_CHANNELS = gql`
  query {
    me {
      channels {
        token
      }
    }
  }
`;

export const CREATE_CUSTOMER = gql`
  mutation ($input: CreateCustomerInput!) {
    createCustomer(input: $input) {
      ... on Customer {
        id
      }
    }
  }
`;

export const CUSTOMERS = gql`
  query {
    customers {
      items {
        id
        emailAddress
        phoneNumber
      }
    }
  }
`;

/** A business and its stores, read to prove a refused call changed nothing. */
export interface BusinessSnapshot {
  readonly business: BusinessView;
  readonly stores: readonly StoreView[];
}
