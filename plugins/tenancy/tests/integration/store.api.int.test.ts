import { failureOf, PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN } from '@cod/testing';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_STORE,
  CHANGE_STORE_SUBDOMAIN,
  CREATE_STORE,
  STORE,
  STORES,
  type StoreView,
  SUBDOMAIN_AVAILABILITY,
  UPDATE_STORE,
} from './admin-api-operations';
import { channelTokenOf, seedAsset } from './admin-api-session';
import { useStoreApi } from './store-api-harness';

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const CHANNEL_LANGUAGES = gql`
  query ($id: ID!) {
    channel(id: $id) {
      defaultLanguageCode
      availableLanguageCodes
    }
  }
`;

describe('Store Admin API', () => {
  const api = useStoreApi(1003);
  const { server, adminClient, asAlpha, rows, channels, sellers, createStore } = api;

  it('lists only the stores of the business, with the channel token', async () => {
    // Arrange
    await asAlpha();

    // Act
    const { stores } = await adminClient.query<{ stores: StoreView[] }>(STORES);

    // Assert
    expect(stores.map((store) => store.businessId)).toEqual(stores.map(() => api.alpha.business.id));
    expect(stores.map((store) => store.id)).not.toContain(api.bravo.store.id);
    expect(stores.find((store) => store.id === api.alpha.store.id)?.channelToken).toBe(
      await channelTokenOf(server.app, api.alpha.store.channelId),
    );
  });

  it('answers null for a store of another business, and refuses to change it', async () => {
    // Arrange
    await asAlpha();
    const before = await rows().findOneByOrFail({ id: api.bravo.store.id });

    // Act
    const { store } = await adminClient.query<{ store: StoreView | null }>(STORE, { id: api.bravo.store.id });
    const update = await failureOf(
      adminClient.query(UPDATE_STORE, { id: api.bravo.store.id, input: { name: 'stolen' } }),
    );
    const archive = await failureOf(adminClient.query(ARCHIVE_STORE, { id: api.bravo.store.id }));
    const rename = await failureOf(
      adminClient.query(CHANGE_STORE_SUBDOMAIN, { id: api.bravo.store.id, subdomain: 'stolen' }),
    );

    // Assert
    expect(store).toBeNull();
    expect([...update.codes, ...archive.codes, ...rename.codes]).toEqual([
      'tenancy.store-not-found',
      'tenancy.store-not-found',
      'tenancy.store-not-found',
    ]);
    expect(await rows().findOneByOrFail({ id: api.bravo.store.id })).toEqual(before);
  });

  it('refuses a malformed store id with a typed error', async () => {
    // Arrange
    await asAlpha();

    // Act
    const failure = await failureOf(adminClient.query(STORE, { id: 'not-an-id' }));

    // Assert
    expect(failure.codes).toEqual(['ids.invalid-snowflake']);
  });

  it('round-trips all eight store settings', async () => {
    // Arrange
    await asAlpha();
    const logoAssetId = await seedAsset(server.app, api.alpha.store.channelId);
    const settings = {
      name: 'Renamed',
      description: 'A description',
      logoAssetId,
      language: 'fr',
      defaultDeliveryFeeGroupId: '9007199254740993',
      defaultCarrierId: '9007199254740995',
      showAddressField: false,
      soldOutBehavior: 'hide',
    };

    // Act
    const { updateStore } = await adminClient.query<{ updateStore: StoreView }>(UPDATE_STORE, {
      id: api.alpha.store.id,
      input: settings,
    });
    const { store } = await adminClient.query<{ store: StoreView }>(STORE, { id: api.alpha.store.id });

    // Assert
    expect(updateStore).toMatchObject(settings);
    expect(store).toMatchObject(settings);
  });

  it('clears a nullable setting on null and keeps it when omitted', async () => {
    // Arrange
    await asAlpha();
    await adminClient.query(UPDATE_STORE, {
      id: api.alpha.store.id,
      input: { defaultCarrierId: '7', description: 'kept' },
    });

    // Act
    const { updateStore } = await adminClient.query<{ updateStore: StoreView }>(UPDATE_STORE, {
      id: api.alpha.store.id,
      input: { defaultCarrierId: null },
    });

    // Assert
    expect(updateStore.defaultCarrierId).toBeNull();
    expect(updateStore.description).toBe('kept');
  });

  it('moves the channel to the new store language (D7)', async () => {
    // Arrange
    await asAlpha();

    // Act
    await adminClient.query(UPDATE_STORE, { id: api.alpha.store.id, input: { language: 'en' } });
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
    const { channel } = await adminClient.query<{ channel: Record<string, unknown> }>(CHANNEL_LANGUAGES, {
      id: String(api.alpha.store.channelId),
    });

    // Assert
    expect(channel).toEqual({ defaultLanguageCode: 'en', availableLanguageCodes: ['en'] });
  });

  it('refuses a language the platform does not offer', async () => {
    // Arrange
    await asAlpha();

    // Act
    const failure = await failureOf(
      adminClient.query(UPDATE_STORE, { id: api.alpha.store.id, input: { language: 'de' } }),
    );

    // Assert
    expect(failure.codes).toEqual(['tenancy.unsupported-store-language']);
  });

  it('returns an id above 2^53 equal to the database text', async () => {
    // Arrange
    await asAlpha();

    // Act
    const store = await createStore('bigid');
    const [row] = await rows().query<{ id: string }[]>('SELECT id::text AS id FROM store WHERE subdomain = $1', [
      'bigid',
    ]);

    // Assert
    expect(BigInt(store.id) > MAX_SAFE).toBe(true);
    expect(store.id).toBe(row?.id);
  });

  it('lets the owner act on a store created in the same session', async () => {
    // Arrange
    await asAlpha();
    const store = await createStore('fresh');

    // Act
    const { updateStore } = await adminClient.query<{ updateStore: StoreView }>(UPDATE_STORE, {
      id: store.id,
      input: { name: 'Fresh name' },
    });

    // Assert
    expect(updateStore.name).toBe('Fresh name');
  });

  it('refuses a taken subdomain without leaving a channel behind', async () => {
    // Arrange
    await asAlpha();
    const before = await channels().count();

    // Act
    const failure = await failureOf(createStore('bravo'));

    // Assert
    expect(failure.codes).toEqual(['tenancy.subdomain-taken']);
    expect(await channels().count()).toBe(before);
  });

  it('refuses a malformed and a reserved subdomain', async () => {
    // Arrange
    await asAlpha();

    // Act
    const malformed = await failureOf(createStore('a'));
    const reserved = await failureOf(createStore('www'));

    // Assert
    expect(malformed.codes).toEqual(['tenancy.subdomain-invalid']);
    expect(reserved.codes).toEqual(['tenancy.subdomain-invalid']);
  });

  it('lets one of two concurrent creates win a subdomain and leaves no orphan', async () => {
    // Arrange
    await asAlpha();
    const [channelsBefore, sellersBefore, storesBefore] = [
      await channels().count(),
      await sellers().count(),
      await rows().count(),
    ];

    // Act
    const outcomes = await Promise.allSettled([createStore('contested'), createStore('contested')]);
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected');
    const failure = await failureOf(Promise.reject(rejected?.reason as Error));

    // Assert
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(failure.codes).toEqual(['tenancy.subdomain-taken']);
    expect(await channels().count()).toBe(channelsBefore + 1);
    expect(await sellers().count()).toBe(sellersBefore);
    expect(await rows().count()).toBe(storesBefore + 1);
  });

  it.each([
    ['stores', STORES, {}],
    ['store', STORE, { id: '1' }],
    ['createStore', CREATE_STORE, { input: { name: 'x y', subdomain: 'forbidden', language: 'ar' } }],
    ['updateStore', UPDATE_STORE, { id: '1', input: { name: 'x y' } }],
    ['archiveStore', ARCHIVE_STORE, { id: '1' }],
    ['changeStoreSubdomain', CHANGE_STORE_SUBDOMAIN, { id: '1', subdomain: 'forbidden' }],
  ])('forbids %s without a tenant', async (_name, operation, variables) => {
    // Arrange: the superadmin on the default channel has every permission but no business.
    const superadminFailure = await failureOf(adminClient.query(operation, variables));

    // Act
    await adminClient.asAnonymousUser();
    const anonymousFailure = await failureOf(adminClient.query(operation, variables));

    // Assert
    expect(superadminFailure.codes).toEqual(['FORBIDDEN']);
    expect(anonymousFailure.codes).toEqual(['FORBIDDEN']);
  });

  it.each([
    ['demo-free', 'available'],
    ['alpha', 'taken'],
    ['ALPHA', 'taken'],
    ['www', 'reserved'],
    ['a', 'invalid'],
    ['xn--mnchen-3ya', 'invalid'],
  ])('reports %s as %s over GraphQL, even anonymously', async (subdomain, status) => {
    // Arrange
    await adminClient.asAnonymousUser();

    // Act
    const { subdomainAvailability } = await adminClient.query<{
      subdomainAvailability: { status: string; reason: string | null };
    }>(SUBDOMAIN_AVAILABILITY, { subdomain });

    // Assert
    expect(subdomainAvailability.status).toBe(status);
    expect(subdomainAvailability.reason === null).toBe(status === 'available');
  });
});
