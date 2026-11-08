import { randomBytes } from 'node:crypto';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from './create-plugin-test-environment';

/** A store of a fixture business. */
export interface StoreFixture {
  readonly id: string;
  readonly channelToken: string;
  readonly subdomain: string;
}

/** The sign-in of a fixture administrator. */
export interface CredentialsFixture {
  readonly email: string;
  readonly password: string;
}

/** A provisioned business: its owner and its two stores. */
export interface BusinessFixture {
  readonly businessId: string;
  readonly owner: CredentialsFixture;
  readonly stores: readonly [StoreFixture, StoreFixture];
}

/** The businesses every isolation test compares. */
export interface TwoBusinesses {
  readonly a: BusinessFixture;
  readonly b: BusinessFixture;
}

/** Synthetic; every owner a fixture provisions signs in with it. */
const FIXTURE_OWNER_PASSWORD = 'synthetic-fixture-owner-password';
const SUFFIX_BYTES = 3;

const STORE_FIELDS = 'id channelToken subdomain';

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

const PROVISION_BUSINESS = gql`
  mutation ($input: ProvisionBusinessInput!) {
    provisionBusiness(input: $input) {
      business {
        id
      }
      store { ${STORE_FIELDS} }
    }
  }
`;

const CREATE_STORE = gql`
  mutation ($input: CreateStoreInput!) {
    createStore(input: $input) { ${STORE_FIELDS} }
  }
`;

interface ProvisionResult {
  readonly provisionBusiness: { readonly business: { readonly id: string }; readonly store: StoreFixture };
}

/** Provisions `label`'s business and opens its second store as its owner, the way a merchant would. */
async function provision(client: SimpleGraphQLClient, label: string, suffix: string): Promise<BusinessFixture> {
  const owner = { email: `${label}-owner-${suffix}@example.test`, password: FIXTURE_OWNER_PASSWORD };
  const { provisionBusiness } = await client.query<ProvisionResult>(PROVISION_BUSINESS, {
    input: {
      name: `${label} SARL`,
      owner: { emailAddress: owner.email, firstName: label, lastName: 'Owner', password: owner.password },
      store: { name: `${label}1 store`, subdomain: `${label}1-${suffix}`, language: 'ar' },
    },
  });
  client.setChannelToken(provisionBusiness.store.channelToken);
  await client.asUserWithCredentials(owner.email, owner.password);
  const { createStore } = await client.query<{ createStore: StoreFixture }>(CREATE_STORE, {
    input: { name: `${label}2 store`, subdomain: `${label}2-${suffix}`, language: 'ar' },
  });
  client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  await client.asSuperAdmin();
  return { businessId: provisionBusiness.business.id, owner, stores: [provisionBusiness.store, createStore] };
}

/**
 * Creates businesses A and B through the Admin API alone, each with an owner and two stores, and leaves the client
 * as the superadmin on the default channel. Subdomains are unique per run, because the host cache outlives a test
 * database.
 */
export async function createTwoBusinesses(client: SimpleGraphQLClient): Promise<TwoBusinesses> {
  const suffix = randomBytes(SUFFIX_BYTES).toString('hex');
  client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  await client.asSuperAdmin();
  await client.query(UPDATE_GLOBAL_LANGUAGES);
  return { a: await provision(client, 'a', suffix), b: await provision(client, 'b', suffix) };
}
