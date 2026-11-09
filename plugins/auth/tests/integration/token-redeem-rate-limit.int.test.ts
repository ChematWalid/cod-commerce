import { RATE_LIMIT_POLICIES } from '@cod/plugin-rate-limit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import type { Caller } from './login-test-client';
import { uniqueIp } from './register-test-kit';

const VERIFY = `mutation ($token: String!) { verifyEmail(token: $token) { success } }`;
const CONFIRM = `mutation ($token: String!) { confirmEmailChange(token: $token) { success } }`;
const RESET = `mutation ($token: String!, $password: String!) { resetPassword(token: $token, password: $password) { __typename } }`;
const TOKEN = 'synthetic-token';
const PASSWORD_BODY = { token: TOKEN, password: 'synthetic-next-password' };
const TOO_MANY_REQUESTS = 429;

const kit = createAccountFlowKit();
const { client } = kit;

type Redemption = (caller: Caller) => Promise<boolean>;

const overGraphql =
  (query: string, variables: object): Redemption =>
  async (caller) =>
    (await client.graphql(query, variables, caller)).errors[0]?.extensions?.code === 'RATE_LIMITED';

const overRest =
  (path: string, body: object): Redemption =>
  async (caller) =>
    (await client.rest(path, body, caller)).status === TOO_MANY_REQUESTS;

/** The six ways to spend an emailed token; they share one bucket per address. */
const REDEMPTIONS: readonly Redemption[] = [
  overGraphql(VERIFY, { token: TOKEN }),
  overGraphql(CONFIRM, { token: TOKEN }),
  overGraphql(RESET, PASSWORD_BODY),
  overRest(`/auth/verify-email/${TOKEN}`, {}),
  overRest('/auth/confirm-email-change', { token: TOKEN }),
  overRest('/auth/reset-password', PASSWORD_BODY),
];

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('spending emailed tokens from one address', () => {
  it('empties one bucket across REST and GraphQL, and leaves other addresses alone', async () => {
    // Arrange
    const caller = { ip: uniqueIp() };
    const rounds = Math.ceil(RATE_LIMIT_POLICIES['token-redeem-ip'].capacity / REDEMPTIONS.length) + 2;
    for (let round = 1; round < rounds; round += 1) {
      for (const redeem of REDEMPTIONS) {
        await redeem(caller);
      }
    }

    // Act
    const limited: boolean[] = [];
    for (const redeem of REDEMPTIONS) {
      limited.push(await redeem(caller));
    }
    const elsewhere = await REDEMPTIONS[0]?.({ ip: uniqueIp() });

    // Assert
    expect(limited).toEqual(REDEMPTIONS.map(() => true));
    expect(elsewhere).toBe(false);
  });
});
