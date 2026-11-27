import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RandomAssetNamingStrategy } from '@cod/plugin-auth';
import { parseInternalKeys } from '@cod/shared/internal-auth';
import { GeoSeedService } from '@cod/plugin-geo';
import { FlagSeedService } from '@cod/plugin-platform-flags';
import { AssetServerPlugin, PresetOnlyStrategy } from '@vendure/asset-server-plugin';
import { TransactionalConnection } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { P3_ISOLATION_CASES } from '../isolation/cases';
import { describeDeliveryPricingIsolation } from '../isolation/cases/delivery-pricing-quote';
import {
  DELIVERY_PRICING_WORLDS,
  deliveryPricingSnapshotOf,
  seedDeliveryPricing,
} from '../isolation/delivery-pricing-world';
import { IsolationHttp } from '../isolation/http';
import { type Outcome, runMatrix } from '../isolation/run';
import { DELIVERY_PRICING_TABLES, tenantRowCounts } from '../isolation/tenant-tables';
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
import { ASSET_ROUTE } from '../../src/config/asset-storage.config';

const SUITE = 'p3-delivery-pricing-isolation';
const PORT = E2E_PORTS.p3DeliveryPricingIsolation;
/** The demo handler registers the one provider a tenant secret can be stored for, and the demo webhook (P1 world). */
const ENV = { PLATFORM_DEMO_HANDLERS: 'true' };
const PASSWORD = 'synthetic-isolation-password';
/** Text no answer may carry: SQL, entity names, stacks (D2136). */
const INTERNALS = [/\bselect\b.+\bfrom\b/i, /QueryFailedError/, /EntityNotFound/, /\bat .+\.(?:js|ts):\d+/];

const runsOf = P3_ISOLATION_CASES.flatMap((testCase) => [
  `${testCase.id} (A→B)`,
  ...(testCase.reverse === true ? [`${testCase.id} (B→A)`] : []),
]);

/**
 * The P3.S1 isolation rows as a test, next to P2's (D2115): the P1 world plus each business's delivery pricing (two
 * groups on its first store, one linked as its default with a commune override, and both stores' seeded tables); then
 * A reaches for B's pricing options through every delivery-pricing endpoint, by id, by list, by write, with B's store
 * token, from A's other store and as A's store-restricted member; links B's group, A's other store's group or any
 * carrier on its own store (#230, #153); quotes and narrows with its own fee table only. Geo tables are reference data,
 * readable by all, outside the census.
 */
describe('P3 isolation: a business sees only its own delivery pricing', () => {
  const env = e2eEnv({ env: ENV });
  const { server } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT, env: ENV }));
  // CI's integration job runs no Garage, so the world's logos go to a local folder instead of S3 (as in P1's suite).
  AssetServerPlugin.init({
    route: ASSET_ROUTE,
    assetUploadDir: mkdtempSync(join(tmpdir(), 'cod-delivery-pricing-isolation-assets-')),
    namingStrategy: new RandomAssetNamingStrategy(),
    imageTransformStrategy: new PresetOnlyStrategy({ defaultPreset: 'medium' }),
  });
  const http = new IsolationHttp(`http://localhost:${String(PORT)}`);
  const sql = () => server.app.get(TransactionalConnection).rawConnection;
  let world: World;
  let outcomes: Map<string, Outcome>;
  let before: Record<'a' | 'b', unknown>;

  const signedGet = async (path: string, signedStoreId: string) => {
    const [key] = parseInternalKeys(env.INTERNAL_HMAC_KEYS);
    if (key === undefined) throw new Error('INTERNAL_HMAC_KEYS holds no signing key: the signed rows need one');
    const call = { method: 'GET', path };
    return sendRaw({
      ...call,
      port: PORT,
      host: `api.${env.PLATFORM_DOMAIN}`,
      headers: signedHeaders(key, call, { storeId: signedStoreId }),
    });
  };

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await afterE2eInit(server);
    await server.app.get(FlagSeedService).converge();
    await server.app.get(GeoSeedService).converge();
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
    DELIVERY_PRICING_WORLDS.set('A', await seedDeliveryPricing(http, world.a));
    DELIVERY_PRICING_WORLDS.set('B', await seedDeliveryPricing(http, world.b));
    before = { a: await deliveryPricingSnapshotOf(http, world.a), b: await deliveryPricingSnapshotOf(http, world.b) };
    const ran = await runMatrix(http, world, P3_ISOLATION_CASES);
    outcomes = new Map(
      ran.map((outcome) => [
        `${outcome.case.id} (${outcome.attacker}→${outcome.attacker === 'A' ? 'B' : 'A'})`,
        outcome,
      ]),
    );
  }, 600_000);

  afterAll(async () => {
    DELIVERY_PRICING_WORLDS.clear();
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('seeds a row of each business in every delivery-pricing tenant table', async () => {
    const counts = await tenantRowCounts(sql(), [world.a.businessId, world.b.businessId], DELIVERY_PRICING_TABLES);

    const empty = DELIVERY_PRICING_TABLES.filter(
      (table) => (counts[table]?.a ?? 0) === 0 || (counts[table]?.b ?? 0) === 0,
    );

    expect(empty).toEqual([]);
  });

  it.each(runsOf)('%s', (run) => {
    const outcome = outcomes.get(run);

    expect(
      outcome?.failures,
      `${run}: HTTP ${String(outcome?.exchange.status)} ${JSON.stringify(outcome?.exchange.body).slice(0, 400)}`,
    ).toEqual([]);
  });

  it('answers every delivery-pricing cell without SQL, entity names or stack text', () => {
    const leaking = [...outcomes.entries()]
      .filter(([, outcome]) => INTERNALS.some((pattern) => pattern.test(JSON.stringify(outcome.exchange.body))))
      .map(([run]) => run);

    expect(leaking).toEqual([]);
  });

  it("answers the CSV import's dry runs naming the victim's group without any of the victim's prices", () => {
    const dryRuns = [...outcomes.entries()].filter(([run]) => run.includes('.dry-run.'));
    const leaking = dryRuns
      .filter(([run, outcome]) => {
        const victim = DELIVERY_PRICING_WORLDS.get(run.endsWith('(A→B)') ? 'B' : 'A');
        const answer = JSON.stringify(outcome.exchange.body);
        return [victim?.homePrice, victim?.communeHomePrice].some((price) =>
          new RegExp(`(?<!\\d)${String(price)}(?!\\d)`).test(answer),
        );
      })
      .map(([run]) => run);

    expect(dryRuns.length).toBeGreaterThan(0);
    expect(leaking).toEqual([]);
  });

  it("leaves each business's pricing options and store defaults as its owner saw them before the attacks", async () => {
    expect(await deliveryPricingSnapshotOf(http, world.a)).toEqual(before.a);
    expect(await deliveryPricingSnapshotOf(http, world.b)).toEqual(before.b);
  });

  describeDeliveryPricingIsolation({ world: () => world, app: () => server.app, signedGet });
});
