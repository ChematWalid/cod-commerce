import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  adminOperationsOf,
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
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { adminApiSchema } from '../../api/schema';
import { TenancyPlugin } from '../../tenancy.plugin';
import {
  ACTIVE_BUSINESS,
  type BusinessView,
  CREATE_CUSTOMER,
  CUSTOMERS,
  ME_CHANNELS,
  STORE,
  STORES,
  type StoreView,
  UPDATE_STORE,
} from './admin-api-operations';
import {
  type AdminApiEntry,
  ADMIN_API_REGISTRY,
  declaredRoutes,
  type Probe,
  REST_ROUTE_REGISTRY,
} from './endpoint-registry';
import { TEST_REDIS_URL } from './tenant-fixtures';

const SAME_PHONE = '+213555000111';

interface BusinessSnapshot {
  readonly business: BusinessView;
  readonly stores: readonly StoreView[];
}

describe('two-business isolation', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: [TenancyPlugin.init({ redisUrl: TEST_REDIS_URL, platformDomain: 'localhost', snowflakeWorkerId: 1003 })],
    db: loadPluginTestDbConfig(process.env),
  });
  let fixtures: TwoBusinesses;
  let member: CredentialsFixture;
  let baselineOfB: BusinessSnapshot;

  const signIn = async (credentials: CredentialsFixture, store: StoreFixture): Promise<void> => {
    adminClient.setChannelToken(store.channelToken);
    await adminClient.asUserWithCredentials(credentials.email, credentials.password);
  };
  const asOwner = (business: BusinessFixture, store = business.stores[0]): Promise<void> =>
    signIn(business.owner, store);

  async function snapshotOfB(): Promise<BusinessSnapshot> {
    await asOwner(fixtures.b);
    const { activeBusiness } = await adminClient.query<{ activeBusiness: BusinessView }>(ACTIVE_BUSINESS);
    const { stores } = await adminClient.query<{ stores: StoreView[] }>(STORES);
    return { business: activeBusiness, stores: [...stores].sort((l, r) => l.id.localeCompare(r.id)) };
  }

  /** B's identifiers in a response, except a subdomain a public check was asked about. */
  function leaksOfB(value: unknown): string[] {
    const text = JSON.stringify(value);
    const { businessId, stores } = fixtures.b;
    return [businessId, ...stores.flatMap((store) => [store.id, store.channelToken, store.subdomain])].filter((secret) =>
      text.includes(secret),
    );
  }

  const queryAs = async (entry: AdminApiEntry, probe: Probe): Promise<unknown> => {
    const data = await adminClient.query<Record<string, unknown>>(entry.document, entry.variables(probe));
    return data[entry.operation];
  };

  async function assertOutcome(entry: AdminApiEntry, probe: Probe): Promise<void> {
    const { outcome } = entry;
    if (outcome.kind === 'rejected') {
      const failure = await failureOf(queryAs(entry, probe));
      expect(failure).toEqual({ codes: [outcome.code], data: null });
      return;
    }
    const value = await queryAs(entry, probe);
    if (outcome.kind === 'null') {
      expect(value).toBeNull();
    } else if (outcome.kind === 'callerOwned') {
      expect(new Set(outcome.businessIdsOf(value))).toEqual(new Set([fixtures.a.businessId]));
      expect(leaksOfB(value)).toEqual([]);
    } else {
      await asOwner(fixtures.b);
      expect(await queryAs(entry, probe)).toEqual(value);
    }
  }

  const victims = (): readonly StoreFixture[] => fixtures.b.stores;
  const probeOf = (victimIndex: number): Probe => ({ ...fixtures, victim: victims()[victimIndex] as StoreFixture });
  const attackCases = ADMIN_API_REGISTRY.flatMap((entry) => [
    { name: `${entry.operation} against B1`, entry, victimIndex: 0 },
    { name: `${entry.operation} against B2`, entry, victimIndex: 1 },
  ]);
  const guardedEntries = ADMIN_API_REGISTRY.filter((entry) => entry.outcome.kind !== 'sameForEveryCaller');

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    fixtures = await createTwoBusinesses(adminClient);
    member = await createMember(server.app, adminClient, {
      code: 'a1-member',
      business: fixtures.a,
      store: fixtures.a.stores[0],
      permissions: ['ReadTenantStore', 'UpdateTenantStore', 'ReadTenantBusiness'],
    });
    baselineOfB = await snapshotOfB();
  });

  afterEach(async () => {
    adminClient.setChannelToken(PLUGIN_TEST_DEFAULT_CHANNEL_TOKEN);
    await adminClient.asSuperAdmin();
  });

  afterAll(async () => {
    await server.destroy();
  });

  it('has a registry entry for every Admin API operation, and none for a removed one', () => {
    // Act
    const registered = ADMIN_API_REGISTRY.map((entry) => entry.operation).sort();

    // Assert
    expect(registered).toEqual(adminOperationsOf(adminApiSchema));
  });

  it('has a registry entry for every REST route, and none for a removed one', () => {
    // Act
    const registered = REST_ROUTE_REGISTRY.map((entry) => entry.route).sort();

    // Assert
    expect(registered).toEqual(declaredRoutes().sort());
  });

  it("has A's two stores and B's two stores, all distinct", () => {
    // Act
    const stores = [...fixtures.a.stores, ...fixtures.b.stores];

    // Assert
    expect(fixtures.a.businessId).not.toBe(fixtures.b.businessId);
    expect(new Set(stores.map((store) => store.channelToken)).size).toBe(stores.length);
  });

  describe("A's owner with B's ids", () => {
    it.each(attackCases)('$name never reaches B', async ({ entry, victimIndex }) => {
      // Arrange
      await asOwner(fixtures.a);

      // Act and Assert
      await assertOutcome(entry, probeOf(victimIndex));
      expect(await snapshotOfB()).toEqual(baselineOfB);
    });
  });

  describe("A's owner on B's channel", () => {
    it.each(guardedEntries)('$operation is FORBIDDEN', async ({ document, variables }) => {
      // Arrange
      await asOwner(fixtures.a);
      const [victim] = fixtures.b.stores;

      // Act
      const failure = await failureOf(
        asChannel(adminClient, victim.channelToken, () => adminClient.query(document, variables(probeOf(0)))),
      );

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it("sees none of B's channels after B opened a store", async () => {
      // Arrange
      await asOwner(fixtures.a);

      // Act
      const { me } = await adminClient.query<{ me: { channels: { token: string }[] } }>(ME_CHANNELS);

      // Assert
      const tokensOfB = fixtures.b.stores.map((store) => store.channelToken);
      expect(me.channels.map((channel) => channel.token)).toEqual(expect.not.arrayContaining(tokensOfB));
      expect(me.channels).toHaveLength(fixtures.a.stores.length);
    });
  });

  describe('a member with a role on one store only', () => {
    it("is FORBIDDEN on the channel of the business's other store", async () => {
      // Arrange
      await signIn(member, fixtures.a.stores[0]);

      // Act
      const failure = await failureOf(
        asChannel(adminClient, fixtures.a.stores[1].channelToken, () => adminClient.query(STORES)),
      );

      // Assert
      expect(failure.codes).toEqual(['FORBIDDEN']);
    });

    it('does not find the other store of its own business, or B', async () => {
      // Arrange
      await signIn(member, fixtures.a.stores[0]);

      // Act
      const { stores } = await adminClient.query<{ stores: StoreView[] }>(STORES);
      const other = await adminClient.query<{ store: StoreView | null }>(STORE, { id: fixtures.a.stores[1].id });
      const ofB = await adminClient.query<{ store: StoreView | null }>(STORE, { id: fixtures.b.stores[0].id });
      const update = await failureOf(
        adminClient.query(UPDATE_STORE, { id: fixtures.a.stores[1].id, input: { name: 'Out of reach' } }),
      );

      // Assert
      expect(stores.map((store) => store.id)).toEqual([fixtures.a.stores[0].id]);
      expect(other.store).toBeNull();
      expect(ofB.store).toBeNull();
      expect(update).toEqual({ codes: ['tenancy.store-not-found'], data: null });
    });
  });

  describe('public REST routes', () => {
    async function get(path: string, headers: Record<string, string>): Promise<{ status: number; body: unknown }> {
      const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
      const response = await fetch(`http://localhost:${String(port)}${path}`, { headers });
      return { status: response.status, body: await response.json() };
    }

    async function callerHeaders(credentials: CredentialsFixture, store: StoreFixture): Promise<Record<string, string>> {
      await signIn(credentials, store);
      return { authorization: `Bearer ${adminClient.getAuthToken()}`, 'vendure-token': store.channelToken };
    }

    it.each(REST_ROUTE_REGISTRY)('$route reveals exactly its public fields to any caller', async (entry) => {
      // Arrange
      const probe = probeOf(0);
      const callers = [
        {},
        await callerHeaders(fixtures.a.owner, fixtures.a.stores[0]),
        await callerHeaders(fixtures.b.owner, fixtures.b.stores[0]),
      ];

      // Act
      const answers = await Promise.all(callers.map((headers) => get(entry.url(probe), headers)));

      // Assert
      for (const answer of answers) {
        expect(answer).toEqual({ status: 200, body: entry.body(probe) });
      }
    });
  });

  // ADR 0002 Evidence: the same buyer phone in two businesses are two customers that never see each other.
  it("keeps a customer with the same phone in each business apart from the other's", async () => {
    // Arrange
    const create = (business: BusinessFixture): Promise<unknown> =>
      asChannel(adminClient, business.stores[0].channelToken, () =>
        adminClient.query(CREATE_CUSTOMER, {
          input: {
            firstName: 'Buyer',
            lastName: 'Same',
            emailAddress: `213555000111@${business.businessId}.customers.example.test`,
            phoneNumber: SAME_PHONE,
          },
        }),
      );
    const list = async (business: BusinessFixture): Promise<string[]> => {
      const { customers } = await asChannel(adminClient, business.stores[0].channelToken, () =>
        adminClient.query<{ customers: { items: { emailAddress: string }[] } }>(CUSTOMERS),
      );
      return customers.items.map((customer) => customer.emailAddress);
    };
    await create(fixtures.a);
    await create(fixtures.b);

    // Act
    const seenByA = await list(fixtures.a);
    const seenByB = await list(fixtures.b);

    // Assert
    expect(seenByA).toEqual([`213555000111@${fixtures.a.businessId}.customers.example.test`]);
    expect(seenByB).toEqual([`213555000111@${fixtures.b.businessId}.customers.example.test`]);
  });
});
