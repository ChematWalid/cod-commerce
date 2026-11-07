import { createTestEnvironment, type TestServer } from '@vendure/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { redisOptionsFromUrl } from '../../src/config/redis-url';
import { buildE2eConfig, E2E_INITIAL_DATA, e2eBullPrefix, e2eEnv, removeBullKeys } from './support/e2e-config';
import { E2E_PORTS } from './support/ports';
import { startTcpProxy, type TcpProxy } from './support/tcp-proxy';

const SUITE = 'redis-down';
const PORT = E2E_PORTS.redisDown;
const READYZ_URL = `http://localhost:${String(PORT)}/readyz`;

/** How long readyz may take to notice that Valkey is gone, or back. */
const SETTLE_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 200;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Polls readyz until it answers `status`, and returns its last answer. */
async function readyzUntil(status: number): Promise<{ status: number; body: unknown }> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const response = await fetch(READYZ_URL);
    const body: unknown = await response.json();
    if (response.status === status || Date.now() > deadline) {
      return { status: response.status, body };
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

/** `REDIS_URL` with its host and port replaced by the proxy's (credentials and database kept). */
function viaProxy(redisUrl: string, proxy: TcpProxy): string {
  const url = new URL(redisUrl);
  url.hostname = '127.0.0.1';
  url.port = String(proxy.port);
  return url.toString();
}

/**
 * Vendure's BullMQ plugin 3.8.1 refuses to boot while Valkey is unreachable (its `RedisHealthIndicator`
 * throws `HealthCheckError: Redis failed` from the strategy's `init`), so the server boots through a proxy to
 * the real Valkey, and the proxy is then cut: Valkey becomes unreachable while the api runs.
 */
describe('readyz with valkey down', () => {
  let proxy: TcpProxy;
  let server: TestServer;

  beforeAll(async () => {
    const { REDIS_URL } = e2eEnv();
    const { host = 'localhost', port = 6379 } = redisOptionsFromUrl(REDIS_URL);
    proxy = await startTcpProxy({ host, port });
    ({ server } = createTestEnvironment(
      buildE2eConfig({}, { suite: SUITE, port: PORT, env: { REDIS_URL: viaProxy(REDIS_URL, proxy) } }),
    ));
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    // Valkey comes back first, so BullMQ and the cache close their connections cleanly.
    await proxy.restore();
    await server.destroy();
    await proxy.close();
    await removeBullKeys(e2eBullPrefix(SUITE));
  });

  it('readyz is 503 when redis is unreachable', async () => {
    await proxy.cut();

    const readyz = await readyzUntil(503);

    expect(readyz.status).toBe(503);
    expect(readyz.body).toMatchObject({
      status: 'not_ready',
      checks: { postgres: { ok: true }, redis: { ok: false } },
    });
  });

  it('readyz is 200 again once redis is back', async () => {
    await proxy.restore();

    const readyz = await readyzUntil(200);

    expect(readyz.status).toBe(200);
  });
});
