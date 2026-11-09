import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { messagesTo, waitForMessages } from './mailpit';
import { codeOf, inputFor, PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const WRONG_PASSWORD = 'synthetic-wrong-password';
const NEW_PASSWORD = 'synthetic-replacement-password';
const LIMIT_TRIES = 11;
const REQUEST = `mutation ($email: String!, $password: String!) {
  requestEmailChange(newEmail: $email, currentPassword: $password) { success }
}`;
const CONFIRM = `mutation ($token: String!) { confirmEmailChange(token: $token) { success } }`;
const ACTIVE = `query { activeAdministrator { emailAddress } }`;
const FORGOT = `mutation ($email: String!) { requestPasswordReset(emailAddress: $email) { ... on Success { success } } }`;
const CHANGE = `mutation ($current: String!, $next: String!) {
  changeAccountPassword(currentPassword: $current, newPassword: $next) { success }
}`;
const QUIET_PERIOD_MS = 1500;

const kit = createAccountFlowKit();
const { client } = kit;

const loginCode = async (email: string, password = PASSWORD): Promise<string> =>
  (await client.login(email, password, { ip: uniqueIp() })).code;

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('change email', () => {
  it('switches only after the confirmation sent to the new address', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const target = uniqueEmail();

    // Act
    const requested = await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
    const token = await kit.tokenInMail(target);
    const pendingStatus = await kit.status(session);
    const beforeOld = await loginCode(email);
    const beforeNew = await loginCode(target);
    const confirmed = await client.graphql(CONFIRM, { token });
    const fresh = await kit.session(target);
    const active = await client.graphql(ACTIVE, {}, fresh);

    // Assert
    expect(requested.errors).toEqual([]);
    expect(pendingStatus['pendingEmail']).toBe(target);
    expect(beforeOld).toBe('OK');
    expect(beforeNew).toBe('INVALID_CREDENTIALS_ERROR');
    expect(confirmed.data?.['confirmEmailChange']?.['success']).toBe(true);
    expect(active.data?.['activeAdministrator']?.['emailAddress']).toBe(target);
    expect(await loginCode(email)).toBe('INVALID_CREDENTIALS_ERROR');
    expect(await kit.status(fresh)).toMatchObject({ pendingEmail: null, emailVerified: true });
  });

  it('tells the old address, and a replayed confirmation is refused', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const target = uniqueEmail();

    // Act
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
    const notices = await waitForMessages(email, 2);
    const token = await kit.tokenInMail(target);
    await client.graphql(CONFIRM, { token });
    const replay = await client.graphql(CONFIRM, { token });

    // Assert
    expect(notices.at(-1)?.Subject).toContain('email-change-notice');
    expect(codeOf(replay)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
  });

  it('cannot tell a taken target from a free one, and mails it nothing', async () => {
    // Arrange
    const free = await kit.owner();
    const taken = await kit.owner();
    const requester = await kit.owner();
    const freeTarget = uniqueEmail();

    // Act
    const answerFree = await client.graphql(REQUEST, { email: freeTarget, password: PASSWORD }, free.session);
    const answerTaken = await client.graphql(REQUEST, { email: taken.email, password: PASSWORD }, requester.session);
    await waitForMessages(requester.email, 2);
    await new Promise((resolve) => setTimeout(resolve, QUIET_PERIOD_MS));
    const statusFree = await kit.status(free.session);
    const statusTaken = await kit.status(requester.session);

    // Assert
    expect(answerTaken.data).toEqual(answerFree.data);
    expect(statusTaken['pendingEmail']).toBe(taken.email);
    expect(Object.keys(statusTaken)).toEqual(Object.keys(statusFree));
    expect(statusTaken['emailVerified']).toBe(statusFree['emailVerified']);
    expect(await messagesTo(taken.email)).toHaveLength(1);
    expect(codeOf(await client.graphql(REQUEST, { email: uniqueEmail(), password: PASSWORD }, requester.session))).toBe(
      AUTH_ERROR_CODES.COOLDOWN,
    );
  });

  it('refuses a second request inside the cooldown', async () => {
    // Arrange
    const { session } = await kit.owner();
    await client.graphql(REQUEST, { email: uniqueEmail(), password: PASSWORD }, session);

    // Act
    const second = await client.graphql(REQUEST, { email: uniqueEmail(), password: PASSWORD }, session);

    // Assert
    expect(codeOf(second)).toBe(AUTH_ERROR_CODES.COOLDOWN);
  });

  it('refuses a wrong current password and writes nothing', async () => {
    // Arrange
    const { session } = await kit.owner();

    // Act
    const answer = await client.graphql(REQUEST, { email: uniqueEmail(), password: WRONG_PASSWORD }, session);

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.CURRENT_PASSWORD_WRONG);
    expect(await kit.status(session)).toMatchObject({ pendingEmail: null });
  });

  it('refuses an address that is not one', async () => {
    // Arrange
    const { session } = await kit.owner();

    // Act
    const answer = await client.graphql(REQUEST, { email: 'not-an-address', password: PASSWORD }, session);

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.EMAIL_INVALID);
  });

  it('limits guesses at the current password', async () => {
    // Arrange
    const { session } = await kit.owner();
    const answers = [];

    // Act
    for (let tried = 0; tried < LIMIT_TRIES; tried += 1) {
      const answer = await client.graphql(REQUEST, { email: uniqueEmail(), password: WRONG_PASSWORD }, session);
      answers.push(codeOf(answer));
    }

    // Assert
    expect(answers.at(-1)).toBe('RATE_LIMITED');
  });

  it('refuses the confirmation when the target was taken meanwhile', async () => {
    // Arrange
    const { session } = await kit.owner();
    const target = uniqueEmail();
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
    const token = await kit.tokenInMail(target);
    await kit.register(inputFor({ email: target }));

    // Act
    const confirmed = await client.graphql(CONFIRM, { token });

    // Assert
    expect(codeOf(confirmed)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
  });

  it('voids an earlier reset link on confirm', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const target = uniqueEmail();
    await client.graphql(FORGOT, { email }, { ip: uniqueIp() });
    const resetToken = await kit.tokenInMail(email, 2);
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
    const token = await kit.tokenInMail(target);

    // Act
    await client.graphql(CONFIRM, { token });
    const stale = await client.rest('/auth/reset-password', { token: resetToken, password: NEW_PASSWORD });

    // Assert
    expect(await stale.json()).toMatchObject({ code: AUTH_ERROR_CODES.INVALID_TOKEN });
  });

  it('voids an open email change when the password changes', async () => {
    // Arrange
    const { session } = await kit.owner();
    const target = uniqueEmail();
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, session);
    const token = await kit.tokenInMail(target);

    // Act
    await client.graphql(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, session);
    const stale = await client.graphql(CONFIRM, { token });

    // Assert
    expect(codeOf(stale)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
  });

  it('works on REST', async () => {
    // Arrange
    const { session } = await kit.owner();
    const target = uniqueEmail();

    // Act
    const requested = await client.rest(
      '/auth/change-email-request',
      { newEmail: target, currentPassword: PASSWORD },
      session,
    );
    const token = await kit.tokenInMail(target);
    const confirmed = await client.rest('/auth/confirm-email-change', { token });

    // Assert
    expect(requested.status).toBeLessThan(300);
    expect(confirmed.status).toBeLessThan(300);
    expect(await loginCode(target)).toBe('OK');
  });

  it.each([['requestEmailChange', REQUEST, { email: 'a@example.test', password: PASSWORD }]])(
    'refuses %s to an anonymous caller',
    async (_name, query, variables) => {
      // Act
      const answer = await client.graphql(query, variables);

      // Assert
      expect(codeOf(answer)).toBe('FORBIDDEN');
    },
  );
});
