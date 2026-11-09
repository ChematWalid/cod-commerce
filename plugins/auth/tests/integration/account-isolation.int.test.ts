import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { codeOf, PASSWORD, uniqueEmail, uniqueIp } from './register-test-kit';

const NEW_PASSWORD = 'synthetic-replacement-password';
const VERIFY = `mutation ($token: String!) { verifyEmail(token: $token) { success } }`;
const VERIFY_OTP = `mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }`;
const REQUEST = `mutation ($email: String!, $password: String!) {
  requestEmailChange(newEmail: $email, currentPassword: $password) { success }
}`;
const CHANGE = `mutation ($current: String!, $next: String!) {
  changeAccountPassword(currentPassword: $current, newPassword: $next) { success }
}`;

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

describe('two accounts stay apart', () => {
  it("refuses A's code from B's session and verifies neither", async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    const code = await kit.codeInMail(a.email);

    // Act
    const answer = await client.graphql(VERIFY_OTP, { code }, b.session);

    // Assert
    expect(codeOf(answer)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(await kit.status(a.session)).toMatchObject({ emailVerified: false });
    expect(await kit.status(b.session)).toMatchObject({ emailVerified: false });
  });

  it("applies A's link to A only when B's session sends it, and returns nothing of A", async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    const token = await kit.tokenInMail(a.email);

    // Act
    const answer = await client.graphql(VERIFY, { token }, b.session);

    // Assert
    expect(answer.data).toEqual({ verifyEmail: { success: true } });
    expect(await kit.status(a.session)).toMatchObject({ emailVerified: true });
    expect(await kit.status(b.session)).toMatchObject({ emailVerified: false });
  });

  it('shows each account its own accountStatus', async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    const target = uniqueEmail();

    // Act
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, b.session);

    // Assert
    expect(await kit.status(b.session)).toMatchObject({ pendingEmail: target });
    expect(await kit.status(a.session)).toMatchObject({ pendingEmail: null });
  });

  it("confirms B's email change on B only", async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    const target = uniqueEmail();
    await client.graphql(REQUEST, { email: target, password: PASSWORD }, b.session);
    const token = await kit.tokenInMail(target);

    // Act
    await client.rest('/auth/confirm-email-change', { token }, a.session);

    // Assert
    expect(await client.me(a.session)).toBe(a.email);
    expect(await loginCode(a.email)).toBe('OK');
    expect(await loginCode(target)).toBe('OK');
    expect(await loginCode(b.email)).toBe('INVALID_CREDENTIALS_ERROR');
  });

  it("changes B's password only, ends no session of A, and refuses A's password as B's current one", async () => {
    // Arrange
    const a = await kit.owner();
    const b = await kit.owner();
    await client.graphql(CHANGE, { current: PASSWORD, next: 'synthetic-a-only-password' }, a.session);
    const aSession = await kit.session(a.email, 'synthetic-a-only-password');

    // Act
    const wrong = await client.graphql(CHANGE, { current: 'synthetic-a-only-password', next: NEW_PASSWORD }, b.session);
    const done = await client.graphql(CHANGE, { current: PASSWORD, next: NEW_PASSWORD }, b.session);

    // Assert
    expect(codeOf(wrong)).toBe(AUTH_ERROR_CODES.CURRENT_PASSWORD_WRONG);
    expect(done.errors).toEqual([]);
    expect(await client.me(aSession)).toBe(a.email);
    expect(await loginCode(a.email, 'synthetic-a-only-password')).toBe('OK');
    expect(await loginCode(a.email, NEW_PASSWORD)).toBe('INVALID_CREDENTIALS_ERROR');
    expect(await loginCode(b.email, NEW_PASSWORD)).toBe('OK');
  });
});
