import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';
import {
  asChannel,
  type CredentialsFixture,
  createMember,
  createPluginTestEnvironment,
  createTwoBusinesses,
  failureOf,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type TwoBusinesses,
} from '@cod/testing';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { tenancyTestPlugins } from './tenant-fixtures';

const SLUG_FOR_ENTITY = gql`
  query ($input: SlugForEntityInput!) {
    slugForEntity(input: $input)
  }
`;
const ACTIVE_CHANNEL = gql`
  query {
    activeChannel {
      id
    }
  }
`;
const ADMINISTRATOR_BY_EMAIL = gql`
  query ($email: String!) {
    administrators(options: { filter: { emailAddress: { eq: $email } } }) {
      items {
        id
      }
    }
  }
`;
const SET_LAST_NAME = gql`
  mutation ($id: ID!, $lastName: String!) {
    updateAdministrator(input: { id: $id, lastName: $lastName }) {
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

const STAFF = { email: 'slug-staff@example.test', password: 'slug-staff-password' };

/**
 * Vendure's `slugForEntity` counts a value over a whole table, whatever the caller's business, so its answer told a
 * merchant whether another business held a value (D500). Only platform staff and the superadmin may call it now.
 */
describe('slugForEntity (D500)', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: tenancyTestPlugins(1013),
    db: loadPluginTestDbConfig(process.env),
  });
  let fixtures: TwoBusinesses;
  let member: CredentialsFixture;
  /** A value that exists in one row only: the last name of B's owner. */
  const privateOfB = 'zqslugprobeprivate';

  const ask = (inputValue: string): Promise<{ slugForEntity: string }> =>
    adminClient.query(SLUG_FOR_ENTITY, { input: { entityName: 'Administrator', fieldName: 'lastName', inputValue } });

  const signIn = async (credentials: CredentialsFixture, channelToken: string): Promise<void> => {
    adminClient.setChannelToken(channelToken);
    await adminClient.asUserWithCredentials(credentials.email, credentials.password);
  };

  async function createPlatformStaff(): Promise<void> {
    const { activeChannel } = await adminClient.query<{ activeChannel: { id: string } }>(ACTIVE_CHANNEL);
    const { createRole } = await adminClient.query<{ createRole: { id: string } }>(CREATE_ROLE, {
      input: {
        code: 'slug-staff',
        description: 'slug-staff',
        permissions: [PLATFORM_STAFF_PERMISSION],
        channelIds: [activeChannel.id],
      },
    });
    await adminClient.query(CREATE_ADMINISTRATOR, {
      input: {
        emailAddress: STAFF.email,
        firstName: 'Slug',
        lastName: 'Staff',
        password: STAFF.password,
        roleIds: [createRole.id],
      },
    });
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    fixtures = await createTwoBusinesses(adminClient);
    member = await createMember(server.app, adminClient, {
      code: 'slug-a1-member',
      business: fixtures.a,
      store: fixtures.a.stores[0],
      permissions: ['ReadTenantStore', 'UpdateTenantStore', 'ReadTenantBusiness'],
    });
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
    const { administrators } = await adminClient.query<{ administrators: { items: { id: string }[] } }>(
      ADMINISTRATOR_BY_EMAIL,
      { email: fixtures.b.owner.email },
    );
    await adminClient.query(SET_LAST_NAME, { id: administrators.items[0]?.id, lastName: privateOfB });
    await createPlatformStaff();
  }, 120_000);

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asAnonymousUser();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it("refuses A's owner on A's own store, so the existence of B's value stays hidden", async () => {
    // Arrange
    await signIn(fixtures.a.owner, fixtures.a.stores[0].channelToken);

    // Act
    const failure = await failureOf(ask(privateOfB));

    // Assert
    expect(failure).toEqual({ codes: ['FORBIDDEN'], data: null });
  });

  it("refuses A's owner on A's second store too", async () => {
    // Arrange
    await signIn(fixtures.a.owner, fixtures.a.stores[1].channelToken);

    // Act and Assert
    expect(await failureOf(ask(privateOfB))).toEqual({ codes: ['FORBIDDEN'], data: null });
  });

  it('refuses a member with a role on one store only', async () => {
    // Arrange
    await signIn(member, fixtures.a.stores[0].channelToken);

    // Act and Assert
    expect(await failureOf(ask(privateOfB))).toEqual({ codes: ['FORBIDDEN'], data: null });
  });

  it("refuses A's owner sending B's channel token", async () => {
    // Arrange
    await signIn(fixtures.a.owner, fixtures.a.stores[0].channelToken);

    // Act
    const failure = await failureOf(asChannel(adminClient, fixtures.b.stores[0].channelToken, () => ask(privateOfB)));

    // Assert
    expect(failure).toEqual({ codes: ['FORBIDDEN'], data: null });
  });

  it("refuses B's own owner as well: no merchant reaches the cross-table count", async () => {
    // Arrange
    await signIn(fixtures.b.owner, fixtures.b.stores[0].channelToken);

    // Act and Assert
    expect(await failureOf(ask(privateOfB))).toEqual({ codes: ['FORBIDDEN'], data: null });
  });

  it('refuses an anonymous caller', async () => {
    expect(await failureOf(ask(privateOfB))).toEqual({ codes: ['FORBIDDEN'], data: null });
  });

  it('still answers the superadmin, with the value taken and a free one left alone', async () => {
    // Arrange
    await adminClient.asSuperAdmin();

    // Act
    const taken = await ask(privateOfB);
    const free = await ask(`${privateOfB}free`);

    // Assert
    expect(taken.slugForEntity).toBe(`${privateOfB}-1`);
    expect(free.slugForEntity).toBe(`${privateOfB}free`);
  });

  it('still answers platform staff', async () => {
    // Arrange
    await signIn(STAFF, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);

    // Act
    const answer = await ask(`${privateOfB}free`);

    // Assert
    expect(answer.slugForEntity).toBe(`${privateOfB}free`);
  });
});
