import { Administrator, TransactionalConnection } from '@vendure/core';
import type { SimpleGraphQLClient } from '@vendure/testing';
import gql from 'graphql-tag';
import { asChannel } from './as-channel';
import { PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from './create-plugin-test-environment';
import type { BusinessFixture, CredentialsFixture, StoreFixture } from './two-businesses';

/** A member to create: a role with `permissions` on `store` only. */
export interface MemberRequest {
  readonly code: string;
  readonly business: BusinessFixture;
  readonly store: StoreFixture;
  readonly permissions: readonly string[];
}

/** The part of the Nest application {@link createMember} uses. */
export interface AppWithConnection {
  get(token: typeof TransactionalConnection): TransactionalConnection;
}

const MEMBER_PASSWORD = 'synthetic-fixture-member-password';

const ACTIVE_CHANNEL = gql`
  query {
    activeChannel {
      id
    }
  }
`;

const CREATE_ROLE = gql`
  mutation ($input: CreateRoleInput!) {
    createRole(input: $input) {
      id
    }
  }
`;

const CREATE_ADMINISTRATOR = gql`
  mutation ($input: CreateAdministratorInput!) {
    createAdministrator(input: $input) {
      id
    }
  }
`;

const wireIdToRowId = (id: string): string => id.replace('T_', '');

/**
 * Creates a member of the business holding a role on one store only, as the superadmin. The tenant link is an
 * `internal` custom field (D2), which no GraphQL input can set, so that one column is written to the row.
 */
export async function createMember(
  app: AppWithConnection,
  client: SimpleGraphQLClient,
  request: MemberRequest,
): Promise<CredentialsFixture> {
  const { code, business, store, permissions } = request;
  const credentials = { email: `${code}@example.test`, password: MEMBER_PASSWORD };
  client.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
  await client.asSuperAdmin();
  const { activeChannel } = await asChannel(client, store.channelToken, () =>
    client.query<{ activeChannel: { id: string } }>(ACTIVE_CHANNEL),
  );
  const { createRole } = await client.query<{ createRole: { id: string } }>(CREATE_ROLE, {
    input: { code, description: code, permissions, channelIds: [activeChannel.id] },
  });
  const { createAdministrator } = await client.query<{ createAdministrator: { id: string } }>(CREATE_ADMINISTRATOR, {
    input: {
      emailAddress: credentials.email,
      firstName: code,
      lastName: 'Member',
      password: credentials.password,
      roleIds: [createRole.id],
    },
  });
  await app
    .get(TransactionalConnection)
    .rawConnection.getRepository(Administrator)
    .update(wireIdToRowId(createAdministrator.id), { customFields: { businessId: business.businessId } });
  return credentials;
}
