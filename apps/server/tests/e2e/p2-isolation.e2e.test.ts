import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATALOG_ERROR_CODES } from '@cod/shared';
import { parseInternalKeys } from '@cod/shared/internal-auth';
import {
  CATALOG_IMPORT_OBJECT_STORAGE,
  CatalogImportPlugin,
  type CatalogImportObjectStorage,
} from '@cod/plugin-catalog-import';
import { FlagSeedService } from '@cod/plugin-platform-flags';
import {
  AssetServerPlugin,
  defaultAssetStorageStrategyFactory,
  PresetOnlyStrategy,
} from '@vendure/asset-server-plugin';
import { TransactionalConnection } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P2_ISOLATION_CASES } from '../isolation/cases';
import { itKeepsImportFilesUnderTheirPrefix, uploadedObjectsOf } from '../isolation/cases/catalog-import-storage';
import { itKeepsStoredRulesInTheirStore } from '../isolation/cases/collections-stored-rule';
import { describeOffersIsolation, type OfferRowsOfBoth, offerRowsOf } from '../isolation/cases/offers';
import { CATALOG_IMPORT_WORLDS, importSnapshotOf, seedCatalogImport } from '../isolation/catalog-import-world';
import {
  CATALOG_SNAPSHOT_FIELDS,
  CATALOG_WORLDS,
  catalogOf,
  otherStoreSnapshotOf,
  seedCatalog,
} from '../isolation/catalog-world';
import {
  COLLECTION_WORLDS,
  collectionsFingerprints,
  collectionsOf,
  COLLECTIONS_SNAPSHOT_FIELDS,
  seedCollections,
  seededCollectionsFilter,
} from '../isolation/collections-world';
import { errorCodesOf, IsolationHttp } from '../isolation/http';
import { ownChannel } from '../isolation/matrix';
import { CORRUPT_PNG, OVERSIZED_PNG, sourceKeyOf, storedState } from '../isolation/media-guard';
import { type Outcome, runMatrix } from '../isolation/run';
import { UPLOAD_CATALOG_MEDIA } from '../isolation/seed-operations';
import { OFFERS_WORLDS, seedOffers } from '../isolation/offers-world';
import { snapshotOf } from '../isolation/snapshot';
import { P2_TENANT_TABLES, RETIRED_TABLES, tenantRowCounts } from '../isolation/tenant-tables';
import { buildWorld, type World } from '../isolation/world';
import {
  afterE2eInit,
  buildE2eConfig,
  E2E_INITIAL_DATA,
  e2eBullPrefix,
  e2eEnv,
  removeBullKeys,
} from './support/e2e-config';
import { E2E_PORTS } from './support/ports';
import { sendRaw, signedHeaders } from './support/signed-request';
import { ASSET_KEY_PREFIX, ASSET_ROUTE } from '../../src/config/asset-storage.config';
import { PrefixedAssetStorage } from '../../src/config/prefixed-asset-storage';
import { TenantAssetNamingStrategy } from '../../src/config/tenant-asset-naming.strategy';

const SUITE = 'p2-isolation';
const PORT = E2E_PORTS.p2Isolation;
/** The demo handler registers the one provider a tenant secret can be stored for, and the demo webhook (P1 world). */
const ENV = { PLATFORM_DEMO_HANDLERS: 'true' };
const PASSWORD = 'synthetic-isolation-password';
const CENSUS_WAIT_MS = 60_000;
const CENSUS_POLL_MS = 500;
/** What each owner's snapshot reads of its first store: the catalog and the collections (P2.S3). */
const FIRST_STORE_FIELDS = `${CATALOG_SNAPSHOT_FIELDS} ${COLLECTIONS_SNAPSHOT_FIELDS}`;
/**
 * The default storefront's collection list, narrowed to the seeded collections' ids so no page can hide one: the Shop
 * API is internal-only (D112), so the call is signed.
 */
const SHOP_COLLECTIONS =
  'query ($options: CollectionListOptions) { collections(options: $options) { totalItems items { name slug } } }';
/** What the Shop API's collection list answers. */
interface ShopCollections {
  readonly data?: { readonly collections?: { readonly totalItems?: unknown } };
}
/** Text no answer may carry: SQL, entity names, stacks (D2136). */
const INTERNALS = [/\bselect\b.+\bfrom\b/i, /QueryFailedError/, /EntityNotFound/, /\bat .+\.(?:js|ts):\d+/];

const runsOf = P2_ISOLATION_CASES.flatMap((testCase) => [
  `${testCase.id} (A→B)`,
  ...(testCase.reverse === true ? [`${testCase.id} (B→A)`] : []),
]);

/**
 * The P2.S1 done criterion as a test (D2115): the P1 world plus a catalog in each business (products with variants,
 * brands, tags, highlights, a collection and a media item in each store); then A reaches for B's catalog through every
 * catalog endpoint, by id, by list, by write, by naming B's rows in its own writes and with B's store token, and A's
 * store-restricted member reaches for A's other store (D2132). Files go through the production naming strategy and
 * key prefix, so the tenant prefixes of stored keys (AC7, #210) are checked on disk. Each business also gets offers
 * (P2.S4), seeded in process, that A's quotes must never see, and A reaches for B's offers and codes through every
 * offers endpoint (P2.S5); collections (P2.S3: manual, by rule, on each store) seeded as its owner through
 * `createStoreCollection`, which A reaches for through every collections endpoint; and a pack, a previewed spreadsheet
 * import, an export and a link import (P2.S2) that A reaches for through every pack and import endpoint, their files
 * stored under the business's and store's prefix of the private bucket.
 */
describe('P2 isolation: a business sees only its own catalog', () => {
  const env = e2eEnv({ env: ENV });
  const { server } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT, env: ENV }));
  const assetDir = mkdtempSync(join(tmpdir(), 'cod-p2-isolation-assets-'));
  // CI's integration job runs no Garage: the files go to a local folder, under the production prefix and naming.
  AssetServerPlugin.init({
    route: ASSET_ROUTE,
    assetUploadDir: assetDir,
    namingStrategy: new TenantAssetNamingStrategy(),
    imageTransformStrategy: new PresetOnlyStrategy({ defaultPreset: 'medium' }),
    storageStrategyFactory: (options) =>
      new PrefixedAssetStorage(defaultAssetStorageStrategyFactory(options), ASSET_KEY_PREFIX),
  });
  // The integration job runs no Garage either: the private bucket is the memory storage, and link imports read the
  // fixture scraper's synthetic pages (D2208, D2214). Re-called after the app config's own `init`, which it replaces.
  CatalogImportPlugin.init({ objectStorage: { kind: 'memory' }, linkScraper: 'fixture', appEnv: env.APP_ENV });
  const http = new IsolationHttp(`http://localhost:${String(PORT)}`);
  const sql = () => server.app.get(TransactionalConnection).rawConnection;
  const storage = () => server.app.get<CatalogImportObjectStorage>(CATALOG_IMPORT_OBJECT_STORAGE);
  const objects = uploadedObjectsOf(storage);
  let world: World;
  let outcomes: Map<string, Outcome>;
  let before: Record<'a' | 'b' | 'aOtherStore' | 'bOtherStore' | 'aImport' | 'bImport', unknown>;
  let offerRows: OfferRowsOfBoth;

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await afterE2eInit(server);
    await server.app.get(FlagSeedService).converge();
    world = await buildWorld({
      http,
      hooks: {
        linkToBusiness: async (administratorId, businessId) => {
          await sql().query('UPDATE "administrator" SET "customFieldsBusinessid" = $1 WHERE "id" = $2', [
            businessId,
            administratorId.replace(/^T_/, ''),
          ]);
        },
      },
      superadmin: { username: env.SUPERADMIN_USERNAME, password: env.SUPERADMIN_PASSWORD },
      suffix: randomBytes(4).toString('hex'),
      password: PASSWORD,
    });
    CATALOG_WORLDS.set('A', await seedCatalog(http, world.a));
    CATALOG_WORLDS.set('B', await seedCatalog(http, world.b));
    COLLECTION_WORLDS.set('A', await seedCollections(http, world.a));
    COLLECTION_WORLDS.set('B', await seedCollections(http, world.b));
    OFFERS_WORLDS.set('A', await seedOffers(server.app, http, world.a));
    OFFERS_WORLDS.set('B', await seedOffers(server.app, http, world.b));
    CATALOG_IMPORT_WORLDS.set('A', await seedCatalogImport(http, objects, world.a));
    CATALOG_IMPORT_WORLDS.set('B', await seedCatalogImport(http, objects, world.b));
    before = {
      a: await snapshotOf(http, world.a, FIRST_STORE_FIELDS),
      b: await snapshotOf(http, world.b, FIRST_STORE_FIELDS),
      aOtherStore: await otherStoreSnapshotOf(http, world.a, COLLECTIONS_SNAPSHOT_FIELDS),
      bOtherStore: await otherStoreSnapshotOf(http, world.b, COLLECTIONS_SNAPSHOT_FIELDS),
      aImport: await importSnapshotOf(http, world.a),
      bImport: await importSnapshotOf(http, world.b),
    };
    offerRows = { a: await offerRowsOf(server.app, world.a), b: await offerRowsOf(server.app, world.b) };
    const ran = await runMatrix(http, world, P2_ISOLATION_CASES);
    outcomes = new Map(
      ran.map((outcome) => [
        `${outcome.case.id} (${outcome.attacker}→${outcome.attacker === 'A' ? 'B' : 'A'})`,
        outcome,
      ]),
    );
  }, 600_000);

  afterAll(async () => {
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it(
    'seeds a row of each business in every P1, catalog, offers, collections, pack and import tenant table',
    async () => {
      // The outbox rows come from the webhooks' asynchronous processing, so the census waits for them.
      const emptyTables = async (): Promise<string[]> => {
        const counts = await tenantRowCounts(sql(), [world.a.businessId, world.b.businessId], P2_TENANT_TABLES);
        return P2_TENANT_TABLES.filter((table) => (counts[table]?.a ?? 0) === 0 || (counts[table]?.b ?? 0) === 0);
      };
      const deadline = Date.now() + CENSUS_WAIT_MS;
      let empty = await emptyTables();
      while (empty.length > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, CENSUS_POLL_MS));
        empty = await emptyTables();
      }

      expect(empty).toEqual([]);
    },
    CENSUS_WAIT_MS + CENSUS_POLL_MS * 10,
  );

  it('writes no row of either business to a retired table (D2309)', async () => {
    const counts = await tenantRowCounts(sql(), [world.a.businessId, world.b.businessId], RETIRED_TABLES);

    expect(Object.values(counts)).toEqual(RETIRED_TABLES.map(() => ({ a: 0, b: 0 })));
  });

  it.each(runsOf)('%s', (run) => {
    const outcome = outcomes.get(run);

    expect(
      outcome?.failures,
      `${run}: HTTP ${String(outcome?.exchange.status)} ${JSON.stringify(outcome?.exchange.body).slice(0, 400)}`,
    ).toEqual([]);
  });

  it('answers every catalog cell without SQL, entity names or stack text', () => {
    const leaking = [...outcomes.entries()]
      .filter(([, outcome]) => INTERNALS.some((pattern) => pattern.test(JSON.stringify(outcome.exchange.body))))
      .map(([run]) => run);

    expect(leaking).toEqual([]);
  });

  it("leaves each business's data and catalog as its owner saw them before the attacks", async () => {
    expect(await snapshotOf(http, world.a, FIRST_STORE_FIELDS)).toEqual(before.a);
    expect(await snapshotOf(http, world.b, FIRST_STORE_FIELDS)).toEqual(before.b);
  });

  it("leaves each business's second store catalog as its owner saw it before the attacks", async () => {
    expect(await otherStoreSnapshotOf(http, world.a, COLLECTIONS_SNAPSHOT_FIELDS)).toEqual(before.aOtherStore);
    expect(await otherStoreSnapshotOf(http, world.b, COLLECTIONS_SNAPSHOT_FIELDS)).toEqual(before.bOtherStore);
  });

  itKeepsStoredRulesInTheirStore({ world: () => world, http, sql });

  it("lists none of either business's collections on the default storefront (D2333)", async () => {
    const [key] = parseInternalKeys(env.INTERNAL_HMAC_KEYS);
    if (key === undefined) throw new Error('INTERNAL_HMAC_KEYS holds no signing key: the Shop census needs one');
    const body = JSON.stringify({ query: SHOP_COLLECTIONS, variables: seededCollectionsFilter([world.a, world.b]) });
    const call = { method: 'POST', path: '/shop-api', body };
    const seeded = [world.a, world.b].flatMap((business) => [
      catalogOf(business).collection.name,
      catalogOf(business).collection.slug,
      ...collectionsFingerprints(collectionsOf(business)),
    ]);

    const answer = await sendRaw({
      ...call,
      port: PORT,
      host: `api.${env.PLATFORM_DOMAIN}`,
      headers: { 'content-type': 'application/json', ...signedHeaders(key, call) },
    });

    expect(answer.status).toBe(200);
    expect((JSON.parse(answer.body) as ShopCollections).data?.collections?.totalItems).toBe(0);
    expect(seeded.filter((value) => answer.body.includes(value))).toEqual([]);
  });

  it("stores A's media file under A's business and store prefix", async () => {
    const [store] = world.a.stores;
    const key = await sourceKeyOf(sql(), catalogOf(world.a).media.assetId);

    expect(key).toMatch(new RegExp(`^b/${world.a.businessId}/s/${store.id}/source/`));
    expect(existsSync(join(assetDir, `${ASSET_KEY_PREFIX}${key ?? ''}`))).toBe(true);
  });

  it("stores A's logo under A's business prefix", async () => {
    const key = await sourceKeyOf(sql(), world.a.logoAssetId);

    // The world uploads the logo on A's first store, so its key also names that store (Task 13 deviation (11)).
    expect(key).toMatch(new RegExp(`^b/${world.a.businessId}/s/${world.a.stores[0].id}/source/`));
    expect(existsSync(join(assetDir, `${ASSET_KEY_PREFIX}${key ?? ''}`))).toBe(true);
  });

  it("leaves each business's pack, imports and export as its owner saw them before the attacks", async () => {
    expect(await importSnapshotOf(http, world.a)).toEqual(before.aImport);
    expect(await importSnapshotOf(http, world.b)).toEqual(before.bImport);
  });

  itKeepsImportFilesUnderTheirPrefix({ world: () => world, http, storage });

  describeOffersIsolation({ world: () => world, app: () => server.app, rowsBeforeMatrix: () => offerRows });

  it.each([
    ['a PNG header with a corrupt body', CORRUPT_PNG],
    ['a PNG over 40 megapixels', OVERSIZED_PNG],
  ] as const)('refuses %s as catalog.media-type and stores nothing', async (_name, bytes) => {
    const stored = await storedState(sql(), assetDir);

    const answer = await http.upload(
      world.a.owner,
      UPLOAD_CATALOG_MEDIA,
      { bytes, name: 'photo.png' },
      ownChannel(world.a),
    );

    expect(errorCodesOf(answer)).toEqual([CATALOG_ERROR_CODES.MEDIA_TYPE]);
    expect(await storedState(sql(), assetDir)).toEqual(stored);
  });
});
