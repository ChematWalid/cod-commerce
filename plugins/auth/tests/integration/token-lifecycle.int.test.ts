import { AUTH_ERROR_CODES, EMAIL_CHANGE_TTL_MS, OTP_TTL_MS, RESET_TOKEN_TTL_MS, VERIFY_LINK_TTL_MS } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { codeOf, PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const NEW_PASSWORD = 'synthetic-replacement-password';
const ONE_MINUTE_MS = 60_000;
const MS_PER_SECOND = 1000;
const OK = 'OK';
const VERIFY = 'mutation ($token: String!) { verifyEmail(token: $token) { success } }';
const VERIFY_OTP = 'mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }';
const RESEND = 'mutation { resendEmailVerification { sentAt } }';
const CONFIRM = 'mutation ($token: String!) { confirmEmailChange(token: $token) { success } }';
const REQUEST = `mutation ($email: String!, $password: String!) {
  requestEmailChange(newEmail: $email, currentPassword: $password) { success }
}`;
const FORGOT =
  'mutation ($email: String!) { requestPasswordReset(emailAddress: $email) { ... on Success { success } } }';

const kit = createAccountFlowKit();
const { client } = kit;

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

/** Moves the user's open tokens (expiry and creation) into the past, which is how real time is waited out. */
async function ageBy(email: string, ms: number): Promise<void> {
  await kit.sql(
    `UPDATE "account_token"
     SET "expiresAt" = "expiresAt" - make_interval(secs => $2), "createdAt" = "createdAt" - make_interval(secs => $2)
     WHERE "userId" = (SELECT "id" FROM "user" WHERE "identifier" = $1)`,
    [email, ms / MS_PER_SECOND],
  );
}

/** A secret that has been issued, and how to spend it where it belongs. */
interface Issued {
  readonly email: string;
  readonly secret: string;
  readonly spend: (secret?: string) => Promise<string>;
}

const outcomeOf = (answer: Awaited<ReturnType<typeof client.graphql>>): string => codeOf(answer) ?? OK;
const restOutcome = async (response: Response): Promise<string> =>
  response.ok ? OK : (((await response.json()) as { code?: string }).code ?? 'NO_CODE');

async function issueVerificationLink(): Promise<Issued> {
  const { email } = await kit.owner();
  const secret = await kit.tokenInMail(email);
  return { email, secret, spend: async (token = secret) => outcomeOf(await client.graphql(VERIFY, { token })) };
}

async function issueResetLink(): Promise<Issued> {
  const { email } = await kit.owner();
  await client.graphql(FORGOT, { email }, { ip: uniqueIp() });
  const secret = await kit.tokenInMail(email, 2);
  const spend = async (token = secret): Promise<string> =>
    restOutcome(await client.rest('/auth/reset-password', { token, password: NEW_PASSWORD }));
  return { email, secret, spend };
}

async function issueEmailChange(): Promise<Issued> {
  const { email, session } = await kit.owner();
  const target = uniqueEmail();
  await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
  const secret = await kit.tokenInMail(target);
  return { email, secret, spend: async (token = secret) => outcomeOf(await client.graphql(CONFIRM, { token })) };
}

async function issueCode(): Promise<Issued> {
  const { email, session } = await kit.owner();
  const secret = await kit.codeInMail(email);
  return {
    email,
    secret,
    spend: async (code = secret) => outcomeOf(await client.graphql(VERIFY_OTP, { code }, session)),
  };
}

const LINKS = [
  {
    name: 'verification link',
    ttl: VERIFY_LINK_TTL_MS,
    issue: issueVerificationLink,
    refusal: AUTH_ERROR_CODES.INVALID_TOKEN,
  },
  {
    name: 'password reset link',
    ttl: RESET_TOKEN_TTL_MS,
    issue: issueResetLink,
    refusal: AUTH_ERROR_CODES.INVALID_TOKEN,
  },
  {
    name: 'email change link',
    ttl: EMAIL_CHANGE_TTL_MS,
    issue: issueEmailChange,
    refusal: AUTH_ERROR_CODES.INVALID_TOKEN,
  },
  { name: 'verification code', ttl: OTP_TTL_MS, issue: issueCode, refusal: AUTH_ERROR_CODES.OTP_INVALID },
] as const;

describe.each(LINKS)('the $name', ({ ttl, issue, refusal }) => {
  it('works one minute before its time is up, and only once', async () => {
    // Arrange
    const issued = await issue();
    await ageBy(issued.email, ttl - ONE_MINUTE_MS);

    // Act
    const first = await issued.spend();
    const replay = await issued.spend();

    // Assert
    expect(first).toBe(OK);
    expect(replay).toBe(refusal);
  });

  it('is refused one minute after its time is up, with the stable code', async () => {
    // Arrange
    const issued = await issue();
    await ageBy(issued.email, ttl + ONE_MINUTE_MS);

    // Act
    const outcome = await issued.spend();

    // Assert
    expect(outcome).toBe(refusal);
  });
});

describe('a verification code outlives nothing the link does not', () => {
  it('stops working after ten minutes while the link of the same email still verifies', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const token = await kit.tokenInMail(email);
    const code = await kit.codeInMail(email);
    // Only the creation time moves: the code counts its ten minutes from it, the link keeps its own expiry.
    await kit.sql(
      `UPDATE "account_token" SET "createdAt" = "createdAt" - make_interval(secs => $2)
       WHERE "userId" = (SELECT "id" FROM "user" WHERE "identifier" = $1)`,
      [email, (OTP_TTL_MS + ONE_MINUTE_MS) / MS_PER_SECOND],
    );

    // Act
    const byCode = await client.graphql(VERIFY_OTP, { code }, session);
    const byLink = await client.graphql(VERIFY, { token });

    // Assert
    expect(codeOf(byCode)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(byLink.errors).toEqual([]);
  });
});

describe('a link belongs to one purpose', () => {
  it('is refused at the endpoint of any other purpose and is not spent by the mistake', async () => {
    // Arrange
    const flows = [await issueVerificationLink(), await issueResetLink(), await issueEmailChange()];

    // Act
    const crossed: string[] = [];
    for (const [index, flow] of flows.entries()) {
      for (const other of flows.filter((_, position) => position !== index)) {
        crossed.push(await other.spend(flow.secret));
      }
    }
    const own = await Promise.all(flows.map((flow) => flow.spend()));

    // Assert
    expect(new Set(crossed)).toEqual(new Set([AUTH_ERROR_CODES.INVALID_TOKEN]));
    expect(own).toEqual([OK, OK, OK]);
  });
});

describe('a newer link voids the older one', () => {
  it('forgot password twice leaves only the second link working', async () => {
    // Arrange
    const { email } = await kit.owner();
    await client.graphql(FORGOT, { email }, { ip: uniqueIp() });
    const first = await kit.tokenInMail(email, 2);
    await client.graphql(FORGOT, { email }, { ip: uniqueIp() });
    const second = await kit.tokenInMail(email, 3);
    const reset = async (token: string): Promise<string> =>
      restOutcome(await client.rest('/auth/reset-password', { token, password: NEW_PASSWORD }));

    // Act
    const old = await reset(first);
    const current = await reset(second);

    // Assert
    expect(first).not.toBe(second);
    expect(old).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
    expect(current).toBe(OK);
  });

  it('a resend voids the earlier link and code of the same email', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const oldToken = await kit.tokenInMail(email);
    const oldCode = await kit.codeInMail(email);
    await kit.ageTokens(email, 2);
    await client.graphql(RESEND, {}, session);
    const newToken = await kit.tokenInMail(email, 2);

    // Act
    const byOldCode = await client.graphql(VERIFY_OTP, { code: oldCode }, session);
    const byOldLink = await client.graphql(VERIFY, { token: oldToken });
    const byNewLink = await client.graphql(VERIFY, { token: newToken });

    // Assert
    expect(codeOf(byOldCode)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(codeOf(byOldLink)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
    expect(byNewLink.errors).toEqual([]);
  });

  it('a second email change request voids the first confirmation', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const firstTarget = uniqueEmail();
    const secondTarget = uniqueEmail();
    await client.graphql(REQUEST, { email: firstTarget, password: PASSWORD }, session);
    const first = await kit.tokenInMail(firstTarget);
    await kit.ageTokens(email, 2);
    await client.graphql(REQUEST, { email: secondTarget, password: PASSWORD }, session);
    const second = await kit.tokenInMail(secondTarget);

    // Act
    const old = await client.graphql(CONFIRM, { token: first });
    const current = await client.graphql(CONFIRM, { token: second });

    // Assert
    expect(codeOf(old)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
    expect(current.errors).toEqual([]);
  });
});

describe('at rest', () => {
  it('keeps no raw link, code or reset token in any account_token or authentication_method column', async () => {
    // Arrange
    const reset = await issueResetLink();
    const { email, session } = await kit.owner();
    const verification = { token: await kit.tokenInMail(email), code: await kit.codeInMail(email) };
    const target = uniqueEmail();
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
    const change = await kit.tokenInMail(target);

    // Act
    const tables = await kit.sql<{ text: string }>(
      `SELECT row_to_json(t)::text AS text FROM "account_token" t
       UNION ALL SELECT row_to_json(m)::text FROM "authentication_method" m`,
    );
    const stored = tables.map((row) => row.text).join('\n');

    // Assert
    const secrets = [reset.secret, verification.token, verification.code, change];
    expect(secrets.every((secret) => secret.length >= 6)).toBe(true);
    expect(secrets.filter((secret) => stored.includes(secret))).toEqual([]);
  });
});
