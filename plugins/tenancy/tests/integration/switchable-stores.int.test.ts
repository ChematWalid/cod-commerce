import {
  asChannel,
  type BusinessFixture,
  type CredentialsFixture,
  createMember,
  createPluginTestEnvironment,
  createTwoBusinesses,
  failureOf,
  loadPluginTestDbConfig,
  PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN,
  PLUGIN_TEST_INITIAL_DATA,
  type StoreFixture,
  type TwoBusinesses,
} from '@cod/testing';
import { TransactionalConnection } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { adminApiSchema } from '../../api/schema';
import { BusinessEntity } from '../../infrastructure/business.entity';
import { ARCHIVE_STORE, CREATE_STORE, SWITCHABLE_STORES } from './admin-api-operations';
import { tenancyTestPlugins } from './tenant-fixtures';

interface SwitchableStoreView {
  readonly id: string;
  readonly businessId: string;
  readonly channelId: string;
  readonly name: string;
  readonly subdomain: string;
  readonly language: string;
}

interface SwitchableView {
  readonly platformDomain: string;
  readonly stores: readonly SwitchableStoreView[];
}

const FORBIDDEN = 'FORBIDDEN';
const PLATFORM_DOMAIN = 'localhost';

describe('switchableStores', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [...tenancyTestPlugins(1003, PLATFORM_DOMAIN)],
    db: loadPluginTestDbConfig(process.env),
  });
  let fixtures: TwoBusinesses;
  let archived: StoreFixture;
  let member: CredentialsFixture;

  const signIn = async (credentials: CredentialsFixture, store: StoreFixture): Promise<void> => {
    adminClient.setChannelToken(store.channelToken);
    await adminClient.asUserWithCredentials(credentials.email, credentials.password);
  };
  const asOwner = (business: BusinessFixture, store = business.stores[0]): Promise<void> =>
    signIn(business.owner, store);
  const switchable = async (): Promise<SwitchableView> =>
    (await adminClient.query<{ switchableStores: SwitchableView }>(SWITCHABLE_STORES)).switchableStores;
  const idsOf = (view: SwitchableView): string[] => view.stores.map((store) => store.id);

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    fixtures = await createTwoBusinesses(adminClient);
    await asOwner(fixtures.a);
    const { createStore } = await adminClient.query<{ createStore: StoreFixture }>(CREATE_STORE, {
      input: { name: 'a3 store', subdomain: `a3-${fixtures.a.stores[0].subdomain}`, language: 'fr' },
    });
    archived = createStore;
    await adminClient.query(ARCHIVE_STORE, { id: archived.id });
    member = await createMember(server.app, adminClient, {
      code: 'switch-member',
      business: fixtures.a,
      store: fixtures.a.stores[1],
      permissions: ['ReadTenantStore'],
    });
  });

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('lists the active stores of the owner oldest first, without the archived one', async () => {
    // Arrange
    await asOwner(fixtures.a);

    // Act
    const view = await switchable();

    // Assert
    expect(view.platformDomain).toBe(PLATFORM_DOMAIN);
    expect(view.stores.map((store) => [store.id, store.name, store.subdomain, store.language])).toEqual([
      [fixtures.a.stores[0].id, 'a1 store', fixtures.a.stores[0].subdomain, 'ar'],
      [fixtures.a.stores[1].id, 'a2 store', fixtures.a.stores[1].subdomain, 'ar'],
    ]);
    expect(view.stores.every((store) => store.businessId === fixtures.a.businessId)).toBe(true);
    expect(view.stores.every((store) => /^\d+$/.test(store.channelId))).toBe(true);
  });

  it('exposes no channel token on the type', () => {
    // Arrange
    const type = adminApiSchema.definitions.find(
      (definition) => 'name' in definition && definition.name?.value === 'SwitchableStore',
    );

    // Act
    const fields = type !== undefined && 'fields' in type ? (type.fields ?? []).map((field) => field.name.value) : [];

    // Assert
    expect(fields).toEqual(['id', 'businessId', 'channelId', 'name', 'subdomain', 'language']);
  });

  it('answers on the channel of an archived store', async () => {
    // Arrange
    await signIn(fixtures.a.owner, archived);

    // Act
    const view = await switchable();

    // Assert
    expect(idsOf(view)).toEqual(fixtures.a.stores.map((store) => store.id));
  });

  it('keeps each business to its own stores, and each has some', async () => {
    // Arrange
    await asOwner(fixtures.a);
    const ofA = idsOf(await switchable());
    await asOwner(fixtures.b);
    const ofB = idsOf(await switchable());

    // Assert
    expect(ofA).toEqual(fixtures.a.stores.map((store) => store.id));
    expect(ofB).toEqual(fixtures.b.stores.map((store) => store.id));
    expect(ofA.filter((id) => ofB.includes(id))).toEqual([]);
  });

  it('gives a member with a role on one store that store only', async () => {
    // Arrange
    await signIn(member, fixtures.a.stores[1]);

    // Act
    const view = await switchable();

    // Assert
    expect(idsOf(view)).toEqual([fixtures.a.stores[1].id]);
  });

  it('refuses an anonymous caller', async () => {
    // Arrange
    await adminClient.asAnonymousUser();

    // Act
    const failure = await failureOf(adminClient.query(SWITCHABLE_STORES));

    // Assert
    expect(failure.codes).toEqual([FORBIDDEN]);
  });

  it('answers a platform superadmin, who has no business, with no stores', async () => {
    // Arrange
    await adminClient.asSuperAdmin();

    // Act
    const view = await switchable();

    // Assert
    expect(view).toEqual({ platformDomain: PLATFORM_DOMAIN, stores: [] });
  });

  it("refuses the owner of A on B's channel", async () => {
    // Arrange
    await asOwner(fixtures.a);

    // Act
    const failure = await failureOf(
      asChannel(adminClient, fixtures.b.stores[0].channelToken, () => adminClient.query(SWITCHABLE_STORES)),
    );

    // Assert
    expect(failure.codes).toEqual([FORBIDDEN]);
  });

  it('answers a suspended business with no stores', async () => {
    // Arrange
    const businesses = server.app.get(TransactionalConnection).rawConnection.getRepository(BusinessEntity);
    await businesses.update({ id: fixtures.b.businessId }, { status: 'suspended' });
    try {
      await asOwner(fixtures.b);

      // Act
      const view = await switchable();

      // Assert
      expect(view.stores).toEqual([]);
    } finally {
      // Later tests use business B as active, whatever this one did.
      await businesses.update({ id: fixtures.b.businessId }, { status: 'active' });
    }
  });
});
