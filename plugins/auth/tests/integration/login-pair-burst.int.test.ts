import { randomUUID } from 'node:crypto';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { NativeAuthenticationStrategy } from '@vendure/core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuthTestEnvironment } from './auth-test-environment';
import { createTestAdministrator } from './create-test-administrator';
import { LoginTestClient } from './login-test-client';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const PASSWORD = 'synthetic-correct-password';
const WRONG_PASSWORD = 'synthetic-wrong-password';
const PAIR_LIMIT = 10;
/** The whole per-address budget, so only the pair limit can stop the burst. */
const PARALLEL_BURST = 60;
const INVALID = 'INVALID_CREDENTIALS_ERROR';
const LIMITED = 'RATE_LIMITED';

const { server, adminClient } = createAuthTestEnvironment(TOKEN_SECRET);
const client = new LoginTestClient(() => server.app);

/** Limiter keys outlive a test run in Valkey, so the test uses an address and an account of its own. */
const uniqueIp = (): string => {
  const bytes = randomUUID().replaceAll('-', '').match(/../g) ?? [];
  return bytes
    .slice(0, 4)
    .map((byte) => parseInt(byte, 16))
    .join('.');
};

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.destroy();
});

describe('login pair limit under a parallel burst (D29, RL-1)', () => {
  it('lets sixty parallel wrong logins of one pair reach the password check at most ten times', async () => {
    // Arrange: the stock check behind the throttle, counted but not replaced
    const email = `owner-${randomUUID()}@example.test`;
    await createTestAdministrator(adminClient, email, PASSWORD);
    const ip = uniqueIp();
    const passwordCheck = vi.spyOn(NativeAuthenticationStrategy.prototype, 'authenticate');

    // Act
    const answers = await Promise.all(
      Array.from({ length: PARALLEL_BURST }, () => client.login(email, WRONG_PASSWORD, { ip })),
    );

    // Assert
    expect(passwordCheck.mock.calls.length).toBeLessThanOrEqual(PAIR_LIMIT);
    expect(answers.filter((answer) => answer.code === INVALID)).toHaveLength(PAIR_LIMIT);
    expect(answers.filter((answer) => answer.code === LIMITED)).toHaveLength(PARALLEL_BURST - PAIR_LIMIT);
  });
});
