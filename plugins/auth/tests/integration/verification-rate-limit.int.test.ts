import { RATE_LIMIT_POLICIES, RATE_LIMITED_CODE, RateLimiter } from '@cod/plugin-rate-limit';
import { AUTH_ERROR_CODES, OTP_TTL_MS } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import type { Caller } from './login-test-client';
import { uniqueIp } from './register-test-kit';

const VERIFY_OTP = `mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }`;
const WRONG_CODE = '000000';
const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const ONE_MINUTE_MS = 60_000;
/** Ages the registration code past its life, so a wrong guess answers OTP_INVALID and never the code's own lock. */
const CLOSE_CODE_MINUTES = OTP_TTL_MS / ONE_MINUTE_MS + 1;
const MINUTE = RATE_LIMIT_POLICIES['otp-account'];
const DAY = RATE_LIMIT_POLICIES['otp-account-daily'];
/** How long an empty bucket waits for one token: its window shared out over its capacity. */
const MINUTE_REFILL_SECONDS = MINUTE.windowSeconds / MINUTE.capacity;
const DAY_REFILL_SECONDS = DAY.windowSeconds / DAY.capacity;
/** Room for the daily bucket refilling a little while the test spends it. */
const DAY_REFILL_SLACK_SECONDS = 60;

const kit = createAccountFlowKit();
const { client } = kit;
let limiter: RateLimiter;

beforeAll(async () => {
  await kit.start();
  limiter = kit.server.app.get(RateLimiter);
});

afterAll(async () => {
  await kit.server.destroy();
});

async function userIdOf(email: string): Promise<string> {
  const [row] = await kit.sql<{ id: number }>(`SELECT "id" FROM "user" WHERE "identifier" = $1`, [email]);
  return String(row?.id);
}

/** What one minute does to the per-user bucket, without the wait: give back every token it can hold. */
async function refillMinuteBucket(userKey: string): Promise<void> {
  for (let token = 0; token < MINUTE.capacity; token += 1) {
    await limiter.refund('otp-account', userKey);
  }
}

/** What one REST answer says: its status, the domain `code` and the limiter's wait, each when present. */
interface RestRefusal {
  readonly status: number;
  readonly code: unknown;
  readonly retryAfterSeconds: unknown;
  readonly retryAfterHeader: string | null;
}

/** One wrong guess over REST, read far enough to tell a limiter refusal from a code refusal. */
async function restGuess(session: Caller): Promise<RestRefusal> {
  const response = await client.rest('/auth/verify-email-otp', { code: WRONG_CODE }, session);
  const body = (await response.json()) as Record<string, unknown>;
  return {
    status: response.status,
    code: body['code'],
    retryAfterSeconds: body['retryAfterSeconds'],
    retryAfterHeader: response.headers.get('retry-after'),
  };
}

/** One wrong guess over GraphQL; answers the error code, if any. */
async function guess(session: Caller): Promise<string | undefined> {
  return (await client.graphql(VERIFY_OTP, { code: WRONG_CODE }, session)).errors[0]?.extensions?.code;
}

/** Each batch comes from a fresh address, so the per-IP policy (otp-ip) never decides the outcome. */
async function spendDailyBudget(session: Caller, userKey: string): Promise<(string | undefined)[]> {
  const answers: (string | undefined)[] = [];
  for (let batch = 0; batch < DAY.capacity / MINUTE.capacity; batch += 1) {
    await refillMinuteBucket(userKey);
    const caller = { ...session, ip: uniqueIp() };
    for (let tried = 0; tried < MINUTE.capacity; tried += 1) {
      answers.push(await guess(caller));
    }
  }
  return answers;
}

describe('code guessing against the real limiter (D29, D44)', () => {
  it('answers the eleventh code in a minute with 429 and a Retry-After of the per-user bucket', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    await kit.ageTokens(email, CLOSE_CODE_MINUTES);
    const firstTen: RestRefusal[] = [];
    for (let tried = 0; tried < MINUTE.capacity; tried += 1) {
      firstTen.push(await restGuess(session));
    }

    // Act
    const eleventh = await restGuess(session);

    // Assert
    expect(firstTen).toEqual(
      firstTen.map(() => ({
        status: BAD_REQUEST,
        code: AUTH_ERROR_CODES.OTP_INVALID,
        retryAfterSeconds: undefined,
        retryAfterHeader: null,
      })),
    );
    expect(eleventh.status).toBe(TOO_MANY_REQUESTS);
    expect(eleventh.code).toBeUndefined();
    const retryAfter = Number(eleventh.retryAfterHeader);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(MINUTE_REFILL_SECONDS);
    expect(eleventh.retryAfterSeconds).toBe(retryAfter);
  });

  it('refuses the fifty-first code of a day as rate-limited for about half an hour, minute after minute', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const userKey = await userIdOf(email);
    const spent = await spendDailyBudget(session, userKey);
    await refillMinuteBucket(userKey);

    // Act
    const answer = await client.graphql(VERIFY_OTP, { code: WRONG_CODE }, { ...session, ip: uniqueIp() });

    // Assert
    expect(spent).toHaveLength(DAY.capacity);
    expect(spent.filter((code) => code === RATE_LIMITED_CODE)).toEqual([]);
    const refusal = answer.errors[0]?.extensions;
    expect(refusal?.code).toBe(RATE_LIMITED_CODE);
    expect(refusal?.retryAfterSeconds).toBeGreaterThan(DAY_REFILL_SECONDS - DAY_REFILL_SLACK_SECONDS);
    expect(refusal?.retryAfterSeconds).toBeLessThanOrEqual(DAY_REFILL_SECONDS);
    expect(Number(answer.headers.get('retry-after'))).toBe(refusal?.retryAfterSeconds);
  });
});
