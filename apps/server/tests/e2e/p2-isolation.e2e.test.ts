import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATALOG_ERROR_CODES } from '@cod/shared';
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
import { CATALOG_SNAPSHOT_FIELDS, CATALOG_WORLDS, catalogOf, seedCatalog } from '../isolation/catalog-world';
import { errorCodesOf, IsolationHttp } from '../isolation/http';
import { ownChannel } from '../isolation/matrix';
import { CORRUPT_PNG, OVERSIZED_PNG, sourceKeyOf, storedState } from '../isolation/media-guard';
import { type Outcome, runMatrix } from '../isolation/run';
import { UPLOAD_CATALOG_MEDIA } from '../isolation/seed-operations';
import { snapshotOf } from '../isolation/snapshot';
import { P2_TENANT_TABLES, tenantRowCounts } from '../isolation/tenant-tables';
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
 * key prefix, so the tenant prefixes of stored keys (AC7, #210) are checked on disk.
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
  const http = new IsolationHttp(`http://localhost:${String(PORT)}`);
  const sql = () => server.app.get(TransactionalConnection).rawConnection;
  let world: World;
  let outcomes: Map<string, Outcome>;
  let before: { a: unknown; b: unknown };

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
    CATALOG_WORLDS.set('A', await seedCatalog(http, world.superadmin, world.a));
    CATALOG_WORLDS.set('B', await seedCatalog(http, world.superadmin, world.b));
    before = {
      a: await snapshotOf(http, world.a, CATALOG_SNAPSHOT_FIELDS),
      b: await snapshotOf(http, world.b, CATALOG_SNAPSHOT_FIELDS),
    };
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
    'seeds a row of each business in every P1 and catalog tenant table',
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
    expect(await snapshotOf(http, world.a, CATALOG_SNAPSHOT_FIELDS)).toEqual(before.a);
    expect(await snapshotOf(http, world.b, CATALOG_SNAPSHOT_FIELDS)).toEqual(before.b);
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
