import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { RequestContextService, TransactionalConnection, User, type RequestContext } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type ProvisionBusinessCommand, ProvisionBusinessService } from '../../application/provision-business.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { StoreEntity } from '../../infrastructure/store.entity';
import { TenancyPlugin } from '../../tenancy.plugin';
import { failureOf } from './graphql-outcome';

const SUPER_ADMIN_ROLE = '__super_admin_role__';
const CUSTOMER_ROLE = '__customer_role__';
const DEFAULT_CHANNEL = '__default_channel__';
const OWNER_PASSWORD = 'synthetic-owner-password';

/** Core ids as the test server sends them (`testConfig`'s id strategy prefixes them). */
const wireId = (id: number): string => `T_${String(id)}`;

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

const ME = gql`
  query {
    me {
      channels {
        id
        code
      }
    }
  }
`;

const CHANNELS = gql`
  query {
    channels {
      items {
        id
      }
    }
  }
`;

const ADMINISTRATOR_ROLES = gql`
  query ($id: ID!) {
    administrator(id: $id) {
      user {
        roles {
          code
          permissions
          channels {
            code
          }
        }
      }
    }
  }
`;

const CHANNEL_DETAIL = gql`
  query ($id: ID!) {
    channel(id: $id) {
      defaultCurrencyCode
      defaultLanguageCode
      availableLanguageCodes
      pricesIncludeTax
      defaultTaxZone {
        name
      }
      defaultShippingZone {
        name
      }
      seller {
        id
        name
      }
    }
  }
`;

const ADMINISTRATOR_CUSTOM_FIELDS_TYPE = gql`
  query {
    __type(name: "AdministratorCustomFields") {
      fields {
        name
      }
    }
    createInput: __type(name: "CreateAdministratorCustomFieldsInput") {
      inputFields {
        name
      }
    }
  }
`;

interface OwnerRole {
  readonly code: string;
  readonly permissions: readonly string[];
  readonly channels: readonly { code: string }[];
}

const commandFor = (slug: string, language = 'ar'): ProvisionBusinessCommand => ({
  name: `${slug} SARL`,
  owner: {
    emailAddress: `${slug}-owner@example.test`,
    firstName: slug,
    lastName: 'Owner',
    password: OWNER_PASSWORD,
  },
  store: { name: `${slug} store`, subdomain: slug, language },
});

describe('Business provisioning', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TenancyPlugin.init({ redisUrl: 'redis://unused', platformDomain: 'localhost', snowflakeWorkerId: 1000 })],
    db: loadPluginTestDbConfig(process.env),
  });

  /** A context with no user at all: what P1.S2's anonymous sign-up will pass. */
  const anonymousContext = (): Promise<RequestContext> =>
    server.app.get(RequestContextService).create({ apiType: 'admin' });

  async function provision(slug: string, language?: string): ReturnType<ProvisionBusinessService['provision']> {
    const ctx = await anonymousContext();
    return server.app.get(ProvisionBusinessService).provision(asOperationContext(ctx), commandFor(slug, language));
  }

  const countOf = (entity: typeof BusinessEntity | typeof StoreEntity): Promise<number> =>
    server.app.get(TransactionalConnection).rawConnection.getRepository(entity).count();

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
  });

  afterEach(async () => {
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('creates a seller, a DZD channel in the store language and a store row', async () => {
    // Act
    const { business, store } = await provision('alpha', 'fr');
    const { channel } = await adminClient.query<{ channel: Record<string, unknown> }>(CHANNEL_DETAIL, {
      id: String(store.channelId),
    });

    // Assert
    expect(channel).toEqual({
      defaultCurrencyCode: 'DZD',
      defaultLanguageCode: 'fr',
      availableLanguageCodes: ['fr'],
      pricesIncludeTax: true,
      defaultTaxZone: { name: 'Algeria' },
      defaultShippingZone: { name: 'Algeria' },
      seller: { id: wireId(business.sellerId), name: 'alpha SARL' },
    });
    const row = await server.app
      .get(TransactionalConnection)
      .rawConnection.getRepository(StoreEntity)
      .findOneByOrFail({ id: store.id });
    expect(row).toMatchObject({ businessId: business.id, subdomain: 'alpha', channelId: store.channelId });
  });

  it('gives the owner only the business role, and no privilege to list channels', async () => {
    // Arrange
    const { administratorId, business } = await provision('bravo');

    // Act
    const { administrator } = await adminClient.query<{ administrator: { user: { roles: OwnerRole[] } } }>(
      ADMINISTRATOR_ROLES,
      { id: String(administratorId) },
    );
    await adminClient.asUserWithCredentials('bravo-owner@example.test', OWNER_PASSWORD);
    const failure = await failureOf(adminClient.query(CHANNELS));

    // Assert
    const roles = administrator.user.roles;
    expect(roles.map((role) => role.code)).toEqual([`owner-${business.id}`]);
    expect(roles.map((role) => role.code)).not.toContain(SUPER_ADMIN_ROLE);
    expect(roles.map((role) => role.code)).not.toContain(CUSTOMER_ROLE);
    expect(roles.flatMap((role) => role.channels.map((channel) => channel.code))).not.toContain(DEFAULT_CHANNEL);
    expect([...(roles[0]?.permissions ?? [])].sort()).toEqual(
      [
        'Authenticated',
        'CreateTenantBusiness',
        'CreateTenantStore',
        'DeleteTenantBusiness',
        'DeleteTenantStore',
        'ReadTenantBusiness',
        'ReadTenantStore',
        'UpdateTenantBusiness',
        'UpdateTenantStore',
      ].sort(),
    );
    expect(failure.codes).toEqual(['FORBIDDEN']);
  });

  it('does not show one business the channels of another', async () => {
    // Arrange
    const first = await provision('charlie');
    const second = await provision('delta');

    // Act
    await adminClient.asUserWithCredentials('charlie-owner@example.test', OWNER_PASSWORD);
    const { me } = await adminClient.query<{ me: { channels: { id: string; code: string }[] } }>(ME);

    // Assert
    expect(me.channels.map((channel) => channel.id)).toEqual([wireId(first.store.channelId)]);
    expect(me.channels.map((channel) => channel.id)).not.toContain(wireId(second.store.channelId));
  });

  it('stores the business link on the administrator without exposing it', async () => {
    // Arrange
    const { administratorId, business } = await provision('echo');
    const connection = server.app.get(TransactionalConnection).rawConnection;

    // Act
    const rows = await connection.query<{ businessId: string }[]>(
      'SELECT "customFieldsBusinessid" AS "businessId" FROM administrator WHERE id = $1',
      [administratorId],
    );
    const schema = await adminClient.query<{
      __type: { fields: { name: string }[] } | null;
      createInput: { inputFields: { name: string }[] } | null;
    }>(ADMINISTRATOR_CUSTOM_FIELDS_TYPE);

    // Assert
    expect(rows).toEqual([{ businessId: business.id }]);
    expect(schema.__type?.fields.map((field) => field.name) ?? []).not.toContain('businessId');
    expect(schema.createInput?.inputFields.map((field) => field.name) ?? []).not.toContain('businessId');
  });

  it('rolls everything back when a late step fails', async () => {
    // Arrange: the same owner email makes the final step, creating the administrator, fail.
    await provision('foxtrot');
    const connection = server.app.get(TransactionalConnection).rawConnection;
    const counts = async (): Promise<number[]> => [
      await countOf(BusinessEntity),
      await countOf(StoreEntity),
      await connection.getRepository('Channel').count(),
      await connection.getRepository('Seller').count(),
      await connection.getRepository('Role').count(),
      await connection.getRepository(User).count(),
    ];
    const before = await counts();
    const duplicate = { ...commandFor('foxtrot'), store: { ...commandFor('golf').store } };

    // Act
    const ctx = await anonymousContext();
    const provisioning = server.app.get(ProvisionBusinessService).provision(asOperationContext(ctx), duplicate);

    // Assert
    await expect(provisioning).rejects.toThrow();
    expect(await counts()).toEqual(before);
  });
});
