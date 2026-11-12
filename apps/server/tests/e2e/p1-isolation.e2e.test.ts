import { randomBytes } from 'node:crypto';
import { TransactionalConnection } from '@vendure/core';
import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ISOLATION_CASES } from '../isolation/cases';
import { IsolationHttp } from '../isolation/http';
import { type Outcome, runMatrix } from '../isolation/run';
import { snapshotOf } from '../isolation/snapshot';
import { TENANT_TABLES, tenantRowCounts } from '../isolation/tenant-tables';
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

const SUITE = 'p1-isolation';
const PORT = E2E_PORTS.isolation;
/** The demo handler registers the one provider a tenant secret can be stored for, and the demo webhook. */
const ENV = { PLATFORM_DEMO_HANDLERS: 'true' };
const PASSWORD = 'synthetic-isolation-password';

/** The test name of each run of a case: A attacks B, and B attacks A for the reverse sample. */
const runsOf = ISOLATION_CASES.flatMap((testCase) => [
  `${testCase.id} (A→B)`,
  ...(testCase.reverse === true ? [`${testCase.id} (B→A)`] : []),
]);

/**
 * The P1 done criterion as a test: a store owner sees only their own business. Two businesses get a row in every
 * P1 tenant table; then A's owner (and, for a sample, B's) reaches for the other's data through every merchant
 * endpoint, by id, by list, by write and with the other's store token. The evidence script runs the same matrix
 * against the live stack (`scripts/evidence/P1-isolation.sh`).
 */
describe('P1 isolation: a store owner sees only their own business', () => {
  const env = e2eEnv({ env: ENV });
  const { server } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT, env: ENV }));
  const http = new IsolationHttp(`http://localhost:${String(PORT)}`);
  let world: World;
  let outcomes: Map<string, Outcome>;
  let before: { a: unknown; b: unknown };

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
    await afterE2eInit(server);
    const connection = server.app.get(TransactionalConnection);
    world = await buildWorld({
      http,
      hooks: {
        linkToBusiness: async (administratorId, businessId) => {
          await connection.rawConnection.query('UPDATE "administrator" SET "customFieldsBusinessid" = $1 WHERE "id" = $2', [
            businessId,
            administratorId.replace(/^T_/, ''),
          ]);
        },
      },
      superadmin: { username: env.SUPERADMIN_USERNAME, password: env.SUPERADMIN_PASSWORD },
      suffix: randomBytes(4).toString('hex'),
      password: PASSWORD,
    });
    before = { a: await snapshotOf(http, world.a), b: await snapshotOf(http, world.b) };
    const ran = await runMatrix(http, world, ISOLATION_CASES);
    outcomes = new Map(ran.map((outcome) => [`${outcome.case.id} (${outcome.attacker}→${outcome.attacker === 'A' ? 'B' : 'A'})`, outcome]));
  }, 300_000);

  afterAll(async () => {
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('seeds a row of each business in every P1 tenant table', async () => {
    const counts = await tenantRowCounts(server.app.get(TransactionalConnection), [world.a.businessId, world.b.businessId]);

    for (const table of TENANT_TABLES) {
      expect({ table, ...counts[table] }).toEqual({ table, a: expect.any(Number), b: expect.any(Number) });
      expect(counts[table]?.a, table).toBeGreaterThan(0);
      expect(counts[table]?.b, table).toBeGreaterThan(0);
    }
  });

  it.each(runsOf)('%s', (run) => {
    const outcome = outcomes.get(run);

    expect(outcome?.failures, `${run}: HTTP ${String(outcome?.exchange.status)} ${JSON.stringify(outcome?.exchange.body).slice(0, 400)}`).toEqual([]);
  });

  it("leaves each business's data as its owner saw it before the attacks", async () => {
    expect(await snapshotOf(http, world.a)).toEqual(before.a);
    expect(await snapshotOf(http, world.b)).toEqual(before.b);
  });
});
