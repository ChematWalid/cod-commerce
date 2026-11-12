import { createTwoBusinesses } from '@cod/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebhooksTestEnvironment, initWithAccounts, webhooksKit } from './webhooks-kit';

const SNOWFLAKE_WORKER_ID = 1002;
const WARM_UP = 10;
const SAMPLES = 100;
const P95_BUDGET_MS = 100;

describe('inbound webhook gateway latency', () => {
  const environment = createWebhooksTestEnvironment(SNOWFLAKE_WORKER_ID);
  const { server, adminClient } = environment;
  const kit = webhooksKit(server);

  beforeAll(async () => {
    await initWithAccounts(environment, () => createTwoBusinesses(adminClient));
  }, 120_000);

  afterAll(async () => {
    await server.destroy();
  });

  it('answers 100 distinct posts with a p95 under 100 ms', async () => {
    // Arrange
    for (let i = 0; i < WARM_UP; i += 1) await kit.post('test', 'acme-a', { body: `{"warm":${String(i)}}` });
    const times: number[] = [];

    // Act
    for (let i = 0; i < SAMPLES; i += 1) {
      const started = performance.now();
      const response = await kit.post('test', 'acme-a', { body: `{"sample":${String(i)}}` });
      times.push(performance.now() - started);
      expect(response.status).toBe(200);
    }

    // Assert
    const sorted = [...times].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(SAMPLES * 0.95) - 1] ?? Infinity;
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  }, 60_000);
});
