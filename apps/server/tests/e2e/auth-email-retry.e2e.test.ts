import { AuthEmailService, AUTH_EMAIL_ATTEMPTS } from '@cod/plugin-auth';
import { RequestContext } from '@vendure/core';
import { BullMQJobQueuePlugin } from '@vendure/job-queue-plugin/package/bullmq';
import { createTestEnvironment } from '@vendure/testing';
import { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authEmailJobOptions, bullMqOptions } from '../../src/config/redis.config';
import {
  buildE2eConfig,
  E2E_INITIAL_DATA,
  e2eBullPrefix,
  e2eEnv,
  e2eRedis,
  removeBullKeys,
  VENDURE_BULLMQ_QUEUE,
} from './support/e2e-config';
import { E2E_PORTS } from './support/ports';

const SUITE = 'auth-email-retry';
const PREFIX = e2eBullPrefix(SUITE);
/** The production builder with a short delay, so five attempts fit in a test. */
const TEST_BACKOFF_MS = 50;
const SETTLE_TIMEOUT_MS = 20_000;
const POLL_MS = 100;
const DEAD_SMTP_PORT = '1';

describe('account email retries on the BullMQ queue', () => {
  const env = { SMTP_HOST: '127.0.0.1', SMTP_PORT: DEAD_SMTP_PORT };
  const { server } = createTestEnvironment(buildE2eConfig({}, { suite: SUITE, port: E2E_PORTS.authEmailRetry, env }));
  const redis = e2eRedis();
  const bullQueue = new Queue(VENDURE_BULLMQ_QUEUE, { prefix: PREFIX, connection: redis });

  beforeAll(async () => {
    // The plugin keeps its options statically: this replaces the ones `buildE2eConfig` just set.
    BullMQJobQueuePlugin.init({
      ...bullMqOptions(e2eEnv({ env })),
      queueOptions: { prefix: PREFIX },
      workerOptions: { prefix: PREFIX },
      setJobOptions: authEmailJobOptions(TEST_BACKOFF_MS),
    });
    await server.init({ initialData: E2E_INITIAL_DATA, customerCount: 0 });
  });

  afterAll(async () => {
    await server.destroy();
    await bullQueue.close();
    await removeBullKeys(PREFIX);
    redis.disconnect();
  });

  it('fails a send five times with the backoff, then gives up', async () => {
    // Act
    await server.app.get(AuthEmailService).enqueue(RequestContext.empty() as never, {
      kind: 'password-changed',
      to: 'owner@example.test',
      locale: 'en',
      vars: { name: 'Sara' },
    });
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    let failed = await bullQueue.getFailed();
    while (failed.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      failed = await bullQueue.getFailed();
    }

    // Assert
    expect(failed).toHaveLength(1);
    expect(failed[0]?.attemptsMade).toBe(AUTH_EMAIL_ATTEMPTS);
    expect(failed[0]?.opts.attempts).toBe(AUTH_EMAIL_ATTEMPTS);
    expect(failed[0]?.opts.backoff).toEqual({ type: 'exponential', delay: TEST_BACKOFF_MS });
  }, 30_000);
});
