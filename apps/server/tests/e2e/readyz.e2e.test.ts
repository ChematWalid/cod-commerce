import { createTestEnvironment } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'readyz';
const PORT = E2E_PORTS.readyz;

describe('readyz', () => {
  const { server } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: PORT }));

  beforeAll(async () => {
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    await server.destroy();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  // No session and no channel token: the health middleware answers before Vendure's AuthGuard.
  it('readyz is 200 with postgres, redis and migrations ok', async () => {
    const response = await fetch(`http://localhost:${String(PORT)}/readyz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ready',
      checks: { postgres: { ok: true }, redis: { ok: true }, migrations: { ok: true } },
    });
  });
});
