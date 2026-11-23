import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { asOperationContext, type ProvisionedBusiness, ProvisionBusinessService } from '@cod/plugin-tenancy';
import { GEO_ERROR_CODES, type Province, type StoreId, WILAYA_COUNT, type WilayaCode } from '@cod/shared';
import { INTERNAL_AUTH_HEADERS } from '@cod/shared/internal-auth';
import { createPluginTestEnvironment, loadPluginTestDbConfig, PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { RequestContextService, TransactionalConnection } from '@vendure/core';
import gql from 'graphql-tag';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeoSeedService } from '../../application/geo-seed.service';
import { TOWN_AVAILABILITY_REGISTRAR, TOWN_DIRECTORY } from '../../application/tokens';
import type { TownAvailability, TownAvailabilityRegistrar } from '../../domain/ports/town-availability.port';
import type { TownDirectory } from '../../domain/ports/town-directory.port';
import { loadGeoSeed } from '../../infrastructure/seed/load-geo-seed';
import { geoTestPlugins } from './geo-test-plugins';

const SNOWFLAKE_WORKER_ID = 960;
const BOOT_TIMEOUT_MS = 120_000;
const SEED = loadGeoSeed();
const ALGER: WilayaCode = '16';
const ALGER_TOWNS = SEED.towns.filter((town) => town.provinceCode === ALGER).length;
const PUBLIC_CACHE = 'public, max-age=300, stale-while-revalidate=86400';
const PRIVATE_CACHE = 'private, no-store';
/** Synthetic: the owner of the fixture business signs in with nothing. */
const OWNER_PASSWORD = 'synthetic-owner-password';

/** Home everywhere in Alger, no desk, except Cheraga (1652): desk only. */
const NARROWED_ALGER: TownAvailability = {
  home: true,
  desk: false,
  towns: new Map([[1652, { home: false, desk: true }]]),
};

const UPDATE_GLOBAL_LANGUAGES = gql`
  mutation {
    updateGlobalSettings(input: { availableLanguages: [ar, fr, en] }) {
      ... on GlobalSettings {
        id
      }
    }
  }
`;

interface Answer {
  readonly status: number;
  readonly cacheControl: string | null;
  readonly body: unknown;
}

// The internal-only guard (D112) is the platform-webhooks plugin's, not registered here: its refusal of an unsigned
// `/store/provinces` call is proven on the full api config (`apps/server/tests/e2e/internal-only.e2e.test.ts`).
describe('the provinces endpoints over REST', () => {
  const { server, adminClient } = createPluginTestEnvironment({
    plugins: geoTestPlugins(SNOWFLAKE_WORKER_ID),
    db: loadPluginTestDbConfig(process.env),
  });
  let shop: ProvisionedBusiness;

  async function get(path: string, headers: Readonly<Record<string, string>> = {}): Promise<Answer> {
    const { port } = (server.app.getHttpServer() as Server).address() as AddressInfo;
    const response = await fetch(`http://localhost:${String(port)}${path}`, { headers });
    return {
      status: response.status,
      cacheControl: response.headers.get('cache-control'),
      body: await response.json(),
    };
  }

  /** The signed store header the storefront sends with every `/store/provinces` call (D3135). */
  const signedFor = (storeId: unknown): Record<string, string> => ({
    [INTERNAL_AUTH_HEADERS.storeId]: String(storeId),
  });

  async function provision(slug: string): Promise<ProvisionedBusiness> {
    const ctx = await server.app.get(RequestContextService).create({ apiType: 'admin' });
    return server.app.get(ProvisionBusinessService).provision(asOperationContext(ctx), {
      name: `${slug} SARL`,
      owner: {
        emailAddress: `${slug}-owner@example.test`,
        firstName: slug,
        lastName: 'Owner',
        password: OWNER_PASSWORD,
      },
      store: { name: `${slug} store`, subdomain: slug, language: 'ar' },
    });
  }

  beforeAll(async () => {
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
    await adminClient.asSuperAdmin();
    await adminClient.query(UPDATE_GLOBAL_LANGUAGES);
    await server.app.get(GeoSeedService).converge();
    shop = await provision('geoshop');
    const narrowed = String(shop.store.id);
    server.app.get<TownAvailabilityRegistrar>(TOWN_AVAILABILITY_REGISTRAR).register({
      availabilityFor: (storeId: StoreId, provinceCode: WilayaCode) =>
        Promise.resolve(storeId === narrowed && provinceCode === ALGER ? NARROWED_ALGER : null),
    });
  }, BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await server.destroy();
  });

  it('lists every wilaya by code, without communes, cacheable by anyone', async () => {
    // Act
    const { status, cacheControl, body } = await get('/provinces');

    // Assert
    const provinces = body as Province[];
    expect(status).toBe(200);
    expect(cacheControl).toBe(PUBLIC_CACHE);
    expect(provinces).toHaveLength(WILAYA_COUNT);
    expect(provinces.map((province) => province.code)).toEqual(SEED.provinces.map((p) => p.code).sort());
    expect(provinces.every((province) => province.towns === undefined && province.id === province.code)).toBe(true);
  });

  it('answers a wilaya with its communes in the data-model shape', async () => {
    // Act
    const { status, body } = await get('/provinces/code/16');

    // Assert
    const province = body as Province;
    expect(status).toBe(200);
    expect(province).toMatchObject({ id: '16', code: '16', name: 'Alger', arabicName: 'الجزائر' });
    expect(province.towns).toHaveLength(ALGER_TOWNS);
    expect(province.towns?.find((town) => town.codeOns === 1601)).toEqual({
      id: '1601',
      ...SEED.towns.find((town) => town.codeOns === 1601),
    });
  });

  it('answers the same wilaya for a code with or without its leading zero', async () => {
    // Act
    const short = await get('/provinces/code/1');
    const padded = await get('/provinces/code/01');

    // Assert
    expect(short.status).toBe(200);
    expect(short.body).toEqual(padded.body);
  });

  it.each(['0', String(WILAYA_COUNT + 1), 'abc', '1.5', '016'])(
    'answers 404 province-not-found, with the same cache header, for the code %s',
    async (code) => {
      // Act
      const { status, cacheControl, body } = await get(`/provinces/code/${code}`);

      // Assert
      expect(status).toBe(404);
      expect(cacheControl).toBe(PUBLIC_CACHE);
      expect(body).toEqual({
        statusCode: 404,
        code: GEO_ERROR_CODES.PROVINCE_NOT_FOUND,
        message: expect.any(String) as string,
        path: `/provinces/code/${code}`,
      });
    },
  );

  it('ignores a storeId on the public routes: reference data only', async () => {
    // Act
    const withStore = await get(`/provinces/code/16?storeId=${String(shop.store.id)}`);
    const reference = await get('/provinces/code/16');

    // Assert
    expect(withStore.body).toEqual(reference.body);
  });

  it('narrows the communes of a store through the registered availability source, never cached publicly', async () => {
    // Act
    const { status, cacheControl, body } = await get(
      `/store/provinces/code/16?storeId=${String(shop.store.id)}`,
      signedFor(shop.store.id),
    );

    // Assert
    const towns = (body as Province).towns ?? [];
    const flagsOf = (codeOns: number) => towns.find((town) => town.codeOns === codeOns);
    expect(status).toBe(200);
    expect(cacheControl).toBe(PRIVATE_CACHE);
    expect(flagsOf(1601)).toMatchObject({ isHomeDelivery: true, isStopdesk: false });
    expect(flagsOf(1652)).toMatchObject({ isHomeDelivery: false, isStopdesk: true });
  });

  it('lists the wilayas for a store as for everyone', async () => {
    // Act
    const forStore = await get(`/store/provinces?storeId=${String(shop.store.id)}`, signedFor(shop.store.id));
    const reference = await get('/provinces');

    // Assert
    expect(forStore.status).toBe(200);
    expect(forStore.cacheControl).toBe(PRIVATE_CACHE);
    expect(forStore.body).toEqual(reference.body);
  });

  it.each([
    ['an unknown id', '/store/provinces/code/16?storeId=999999', signedFor('999999')],
    ['a malformed id', '/store/provinces/code/16?storeId=abc', signedFor('abc')],
    ['no id', '/store/provinces', {}],
    ['a served id without the signed store header', '/store/provinces/code/16?storeId=SHOP', {}],
  ])('answers 404 store-not-found for %s', async (_label, rawPath, headers) => {
    // Act
    const { status, cacheControl, body } = await get(rawPath.replace('SHOP', String(shop.store.id)), headers);

    // Assert
    expect(status).toBe(404);
    expect(cacheControl).toBe(PRIVATE_CACHE);
    expect(body).toMatchObject({ code: GEO_ERROR_CODES.STORE_NOT_FOUND });
  });

  it('answers 404 store-not-found when the signed store header names another store than the query (D3135)', async () => {
    // Arrange
    const other = await provision('geoother');
    const path = `/store/provinces/code/16?storeId=${String(shop.store.id)}`;

    // Act
    const mismatched = await get(path, signedFor(other.store.id));
    const listMismatched = await get(`/store/provinces?storeId=${String(shop.store.id)}`, signedFor(other.store.id));
    const matching = await get(path, signedFor(shop.store.id));

    // Assert
    expect(mismatched.status).toBe(404);
    expect(mismatched.cacheControl).toBe(PRIVATE_CACHE);
    expect(mismatched.body).toMatchObject({ code: GEO_ERROR_CODES.STORE_NOT_FOUND });
    expect(listMismatched.status).toBe(404);
    expect(listMismatched.body).toMatchObject({ code: GEO_ERROR_CODES.STORE_NOT_FOUND });
    expect(matching.status).toBe(200);
  });

  it('answers 404 store-not-found once the store is archived', async () => {
    // Arrange
    const gone = await provision('geogone');
    await server.app
      .get(TransactionalConnection)
      .rawConnection.query(`UPDATE "store" SET "status" = 'archived' WHERE "id" = $1`, [gone.store.id]);

    // Act
    const { status, body } = await get(`/store/provinces?storeId=${String(gone.store.id)}`, signedFor(gone.store.id));

    // Assert
    expect(status).toBe(404);
    expect(body).toMatchObject({ code: GEO_ERROR_CODES.STORE_NOT_FOUND });
  });

  it('answers 404 province-not-found for a served store and an invalid code', async () => {
    // Act
    const { status, body } = await get(
      `/store/provinces/code/${String(WILAYA_COUNT + 1)}?storeId=${String(shop.store.id)}`,
      signedFor(shop.store.id),
    );

    // Assert
    expect(status).toBe(404);
    expect(body).toMatchObject({ code: GEO_ERROR_CODES.PROVINCE_NOT_FOUND });
  });

  it('serves the town directory delivery pricing injects from the seeded communes', async () => {
    // Arrange
    const directory = server.app.get<TownDirectory>(TOWN_DIRECTORY);

    // Act
    const towns = await directory.townsOf(ALGER);

    // Assert
    const seeded = SEED.towns.filter((town) => town.provinceCode === ALGER).map((town) => town.codeOns);
    expect([...towns].sort((left, right) => left - right)).toEqual(seeded.sort((left, right) => left - right));
  });

  it("answers a seeded commune's reference flags through the town directory, and nothing for another wilaya", async () => {
    // Arrange
    const directory = server.app.get<TownDirectory>(TOWN_DIRECTORY);
    const seeded = SEED.towns.find((town) => town.provinceCode === ALGER);
    if (seeded === undefined) throw new Error('the seed has no commune in Alger');

    // Act
    const town = await directory.townOf(ALGER, seeded.codeOns);
    const elsewhere = await directory.townOf('01', seeded.codeOns);

    // Assert
    expect(town).toMatchObject({ codeOns: seeded.codeOns, isStopdesk: seeded.isStopdesk });
    expect(elsewhere).toBeUndefined();
  });
});
