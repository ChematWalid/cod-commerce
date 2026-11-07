import { bootstrapWorker } from '@vendure/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrate } from '../../src/roles/migrate.role';
import { buildE2eConfig, e2eBullPrefix, e2eEnv, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';
import { createDatabase, dropDatabase } from './support/test-database';

const SUITE = 'worker-health';
const DATABASE_NAME = `cod_worker_health_${String(process.pid)}`;
const HEALTH_PORT = E2E_PORTS.workerHealth;

type Worker = Awaited<ReturnType<typeof bootstrapWorker>>;

// Its own file: Vendure's scheduler names its cron jobs process-wide, so a worker cannot boot beside a
// running api in one process.
describe('worker health server', () => {
  let worker: Worker | undefined;

  beforeAll(async () => {
    const url = await createDatabase(DATABASE_NAME);
    const env = { DATABASE_URL: url, DATABASE_URL_DIRECT: url, WORKER_HEALTH_PORT: String(HEALTH_PORT) };
    await runMigrate(e2eEnv({ env, role: 'migrate' }));
    worker = await bootstrapWorker(
      buildE2eConfig({}, { suite: SUITE, port: E2E_PORTS.workerApiUnused, role: 'worker', env }),
    );
    await worker.startJobQueue();
  });

  afterAll(async () => {
    await worker?.app.close();
    await dropDatabase(DATABASE_NAME);
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('the worker serves readyz on its health port under bootstrapWorker', async () => {
    const response = await fetch(`http://localhost:${String(HEALTH_PORT)}/readyz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ready',
      checks: { postgres: { ok: true }, redis: { ok: true }, migrations: { ok: true } },
    });
  });

  it('the worker serves livez on its health port', async () => {
    const response = await fetch(`http://localhost:${String(HEALTH_PORT)}/livez`);

    expect(response.status).toBe(200);
  });
});
