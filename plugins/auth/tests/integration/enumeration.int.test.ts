import { AUTH_ERROR_CODES, RESEND_COOLDOWN_MS } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { AUTH_TOKEN_HEADER } from './login-test-client';
import { messagesTo, waitForMessages } from './mailpit';
import { codeOf, inputFor, PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';
import { settle } from './two-business-kit';

const WRONG_PASSWORD = 'synthetic-wrong-password';
const NORMALISED_TARGET = 'the-requested-address';
const FORGOT = `mutation ($email: String!) {
  requestPasswordReset(emailAddress: $email) { ... on Success { success } ... on ErrorResult { errorCode } }
}`;
const REQUEST = `mutation ($email: String!, $password: String!) {
  requestEmailChange(newEmail: $email, currentPassword: $password) { success }
}`;
const RESEND = 'mutation { resendEmailVerification { sentAt nextAllowedAt } }';
const VERIFY_OTP = 'mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }';

const kit = createAccountFlowKit();
const { client } = kit;

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

/** What a caller sees of a response that must not depend on whether an account exists. */
async function seenOf(response: Response): Promise<unknown> {
  return {
    status: response.status,
    // A REST error body carries the time it was made.
    body: (await response.text()).replace(/"timestamp":"[^"]*"/, '"timestamp":"-"'),
    hasSession: response.headers.get(AUTH_TOKEN_HEADER) !== null,
    hasCookie: response.headers.getSetCookie().length > 0,
  };
}

describe('login', () => {
  it('answers a wrong password and an unknown email alike on GraphQL', async () => {
    // Arrange
    const { email } = await kit.owner();

    // Act
    const known = await client.login(email, WRONG_PASSWORD, { ip: uniqueIp() });
    const unknown = await client.login(uniqueEmail(), WRONG_PASSWORD, { ip: uniqueIp() });

    // Assert
    expect(known.code).toBe('INVALID_CREDENTIALS_ERROR');
    expect(unknown).toEqual({ ...known, cookie: '' });
    expect(known.token).toBeNull();
  });

  it('answers a wrong password and an unknown email alike on REST', async () => {
    // Arrange
    const { email } = await kit.owner();
    const attempt = (username: string): Promise<Response> =>
      client.rest('/auth/login', { username, password: WRONG_PASSWORD }, { ip: uniqueIp() });

    // Act
    const known = await seenOf(await attempt(email));
    const unknown = await seenOf(await attempt(uniqueEmail()));

    // Assert
    expect(known).toMatchObject({ status: 401, hasSession: false });
    expect(unknown).toEqual(known);
  });
});

describe('forgot password', () => {
  it('answers a verified, an unverified and an unknown email alike on GraphQL, and mails only the accounts', async () => {
    // Arrange
    const unverified = await kit.owner();
    const verified = await kit.owner();
    await client.graphql('mutation ($token: String!) { verifyEmail(token: $token) { success } }', {
      token: await kit.tokenInMail(verified.email),
    });
    const unknown = uniqueEmail();

    // Act
    const answers = [];
    for (const email of [unverified.email, verified.email, unknown]) {
      const response = await client.rest('/admin-api', { query: FORGOT, variables: { email } }, { ip: uniqueIp() });
      answers.push(await seenOf(response));
    }
    await waitForMessages(unverified.email, 2);
    await waitForMessages(verified.email, 2);
    await settle();

    // Assert
    expect(answers[1]).toEqual(answers[0]);
    expect(answers[2]).toEqual(answers[0]);
    expect(JSON.parse((answers[0] as { body: string }).body)).toEqual({
      data: { requestPasswordReset: { success: true } },
    });
    expect(await messagesTo(unknown)).toHaveLength(0);
  });

  it('spends the same limit for a known and an unknown email', async () => {
    // Arrange
    const { email } = await kit.owner();
    const ip = uniqueIp();
    const results: Record<string, string[]> = { known: [], unknown: [] };
    const unknown = uniqueEmail();

    // Act
    for (let attempt = 0; attempt < 12; attempt += 1) {
      for (const [name, address] of [
        ['known', email],
        ['unknown', unknown],
      ] as const) {
        const answer = await client.graphql(FORGOT, { email: address }, { ip });
        results[name]?.push(codeOf(answer) ?? 'OK');
      }
    }

    // Assert
    expect(results['unknown']).toEqual(results['known']);
    expect(results['known']).toContain('RATE_LIMITED');
  });
});

describe('resend', () => {
  it('answers a verified and an unverified account in the same shape, and a signed-out caller identically', async () => {
    // Arrange
    const unverified = await kit.owner();
    const verified = await kit.owner();
    await client.graphql('mutation ($token: String!) { verifyEmail(token: $token) { success } }', {
      token: await kit.tokenInMail(verified.email),
    });
    await kit.ageTokens(unverified.email, 2);
    await kit.ageTokens(verified.email, 2);

    // Act
    const first = await client.graphql(RESEND, {}, unverified.session);
    const second = await client.graphql(RESEND, {}, verified.session);
    const anonymous = await client.graphql(RESEND, {});
    const again = await client.graphql(RESEND, {}, unverified.session);

    // Assert
    for (const answer of [first, second]) {
      const result = answer.data?.['resendEmailVerification'] as { sentAt: string; nextAllowedAt: string };
      expect(Object.keys(result)).toEqual(['sentAt', 'nextAllowedAt']);
      expect(Date.parse(result.nextAllowedAt) - Date.parse(result.sentAt)).toBe(RESEND_COOLDOWN_MS);
    }
    expect(codeOf(anonymous)).toBe('FORBIDDEN');
    expect(codeOf(again)).toBe(AUTH_ERROR_CODES.COOLDOWN);
  });

  it('refuses a wrong code the same way whoever owns the code, so a guess confirms nothing', async () => {
    // Arrange
    const first = await kit.owner();
    const second = await kit.owner();
    const codeOfSecond = await kit.codeInMail(second.email);

    // Act
    const guessAtOwn = await client.graphql(VERIFY_OTP, { code: '000000' }, first.session);
    const guessAtOther = await client.graphql(VERIFY_OTP, { code: codeOfSecond }, first.session);

    // Assert
    expect(codeOf(guessAtOwn)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(codeOf(guessAtOther)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(guessAtOther.errors[0]?.message).toBe(guessAtOwn.errors[0]?.message);
  });
});

describe('change-email target', () => {
  it('answers a free, a taken and a differently written taken target alike, on GraphQL and REST', async () => {
    // Arrange
    const taken = await kit.owner();
    const requesters = [await kit.owner(), await kit.owner(), await kit.owner(), await kit.owner()];
    const targets = [uniqueEmail(), taken.email, `  ${taken.email.toUpperCase()} `];

    // Act
    const graphql = [];
    for (const [index, target] of targets.entries()) {
      const answer = await client.graphql(REQUEST, { email: target, password: PASSWORD }, requesters[index]?.session);
      graphql.push({ data: answer.data, errors: answer.errors });
    }
    const rest = await seenOf(
      await client.rest(
        '/auth/change-email-request',
        { newEmail: taken.email, currentPassword: PASSWORD },
        requesters[3]?.session,
      ),
    );
    const restFree = await seenOf(
      await client.rest(
        '/auth/change-email-request',
        { newEmail: uniqueEmail(), currentPassword: PASSWORD },
        (await kit.owner()).session,
      ),
    );

    // Assert
    expect(graphql[1]).toEqual(graphql[0]);
    expect(graphql[2]).toEqual(graphql[0]);
    expect(rest).toEqual(restFree);
    expect(rest).toMatchObject({ status: 200, body: '{"success":true}' });
  });

  it('shows the requester a field-identical accountStatus for a free and a taken target (only the echoed target differs)', async () => {
    // Arrange
    const taken = await kit.owner();
    const forFree = await kit.owner();
    const forTaken = await kit.owner();
    const freeTarget = uniqueEmail();
    const beforeFree = await kit.status(forFree.session);
    const beforeTaken = await kit.status(forTaken.session);

    // Act
    await client.graphql(REQUEST, { email: freeTarget, password: PASSWORD }, forFree.session);
    await client.graphql(REQUEST, { email: taken.email, password: PASSWORD }, forTaken.session);
    const afterFree = await kit.status(forFree.session);
    const afterTaken = await kit.status(forTaken.session);

    // Assert
    expect(afterFree).toEqual({ ...beforeFree, pendingEmail: freeTarget });
    expect(afterTaken).toEqual({ ...beforeTaken, pendingEmail: taken.email });
    expect({ ...afterFree, pendingEmail: NORMALISED_TARGET, resendAvailableAt: null }).toEqual({
      ...afterTaken,
      pendingEmail: NORMALISED_TARGET,
      resendAvailableAt: null,
    });
    expect(Object.keys(afterTaken)).toEqual(Object.keys(afterFree));
  });

  it('mails the free target a confirmation and the taken account nothing, with the requester mailed the same in both cases', async () => {
    // Arrange
    const taken = await kit.owner();
    const forFree = await kit.owner();
    const forTaken = await kit.owner();
    const freeTarget = uniqueEmail();
    // Its own verification mail is sent after registration returns; counted before it lands, it reads as a leak.
    const takenMailsBefore = (await waitForMessages(taken.email, 1)).length;

    // Act
    await client.graphql(REQUEST, { email: freeTarget, password: PASSWORD }, forFree.session);
    await client.graphql(REQUEST, { email: taken.email, password: PASSWORD }, forTaken.session);
    await waitForMessages(freeTarget, 1);
    await waitForMessages(forFree.email, 2);
    await waitForMessages(forTaken.email, 2);
    await settle();

    // Assert
    expect(await messagesTo(taken.email)).toHaveLength(takenMailsBefore);
    expect((await messagesTo(forFree.email)).map((mail) => mail.Subject)).toEqual(
      (await messagesTo(forTaken.email)).map((mail) => mail.Subject),
    );
  });
});

describe('registration, the one disclosure (D27)', () => {
  it('says a taken email is taken, and creates nothing', async () => {
    // Arrange
    const { email } = await kit.owner();
    const before = await kit.counts();

    // Act
    const answer = await kit.register(inputFor({ email }));

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.EMAIL_TAKEN);
    expect(await kit.counts()).toEqual(before);
  });

  it('says it for the same email written in another case or with spaces', async () => {
    // Arrange
    const { email } = await kit.owner();

    // Act
    const answer = await kit.register(inputFor({ email: `  ${email.toUpperCase()}  ` }));

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.EMAIL_TAKEN);
  });
});
