import { AUTH_ERROR_CODES } from '@cod/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAccountFlowKit } from './account-flow-kit';
import { createTestAdministrator } from './create-test-administrator';
import { codeOf, PASSWORD, uniqueEmail } from './register-test-kit';

const VERIFY = `mutation ($token: String!) { verifyEmail(token: $token) { success } }`;
const VERIFY_OTP = `mutation ($code: String!) { verifyEmailOtp(code: $code) { success } }`;
const RESEND = `mutation { resendEmailVerification { sentAt nextAllowedAt } }`;
const STATUS = `query { accountStatus { emailVerified } }`;
const WRONG_CODE = '000000';
const OTP_LOCK_AFTER = 5;

const kit = createAccountFlowKit();
const { client } = kit;

beforeAll(async () => {
  await kit.start();
});

afterAll(async () => {
  await kit.server.destroy();
});

describe('email verification', () => {
  it('verifies by link, once, and flips accountStatus', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const token = await kit.tokenInMail(email);
    const before = await kit.status(session);

    // Act
    const first = await client.graphql(VERIFY, { token });
    const replay = await client.graphql(VERIFY, { token });

    // Assert
    expect(before).toMatchObject({ emailVerified: false, verificationRequired: true, pendingEmail: null });
    expect(first.data?.['verifyEmail']?.['success']).toBe(true);
    expect(codeOf(replay)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
    expect(await kit.status(session)).toMatchObject({ emailVerified: true });
  });

  it('verifies by code and spends the row the link shares', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const token = await kit.tokenInMail(email);
    const code = await kit.codeInMail(email);

    // Act
    const verified = await client.graphql(VERIFY_OTP, { code }, session);
    const replay = await client.graphql(VERIFY_OTP, { code }, session);
    const link = await client.graphql(VERIFY, { token });

    // Assert
    expect(verified.data?.['verifyEmailOtp']?.['success']).toBe(true);
    expect(codeOf(replay)).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(codeOf(link)).toBe(AUTH_ERROR_CODES.INVALID_TOKEN);
    expect(await kit.status(session)).toMatchObject({ emailVerified: true });
  });

  it('locks after five wrong codes until a resend after the cooldown issues a working one', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const code = await kit.codeInMail(email);
    const attempts = [];

    // Act
    for (let tried = 0; tried < OTP_LOCK_AFTER; tried += 1) {
      attempts.push(codeOf(await client.graphql(VERIFY_OTP, { code: WRONG_CODE }, session)));
    }
    const lockedRightCode = await client.graphql(VERIFY_OTP, { code }, session);
    await kit.ageTokens(email, 2);
    const resent = await client.graphql(RESEND, {}, session);
    const fresh = await kit.codeInMail(email, 2);
    const verified = await client.graphql(VERIFY_OTP, { code: fresh }, session);

    // Assert
    expect(attempts.at(-1)).toBe(AUTH_ERROR_CODES.OTP_LOCKED);
    expect(codeOf(lockedRightCode)).toBe(AUTH_ERROR_CODES.OTP_LOCKED);
    expect(resent.errors).toEqual([]);
    expect(verified.data?.['verifyEmailOtp']?.['success']).toBe(true);
  });

  it('refuses a resend inside the cooldown and states when it opens', async () => {
    // Arrange
    const { session } = await kit.owner();

    // Act
    const refused = await client.graphql(RESEND, {}, session);
    const status = await kit.status(session);

    // Assert
    expect(codeOf(refused)).toBe(AUTH_ERROR_CODES.COOLDOWN);
    expect(new Date(status['resendAvailableAt'] as string).getTime()).toBeGreaterThan(Date.now());
  });

  it('does not spend the token on a GET, which is what a mail scanner sends', async () => {
    // Arrange
    const { email } = await kit.owner();
    const token = await kit.tokenInMail(email);

    // Act
    const scan = await fetch(client.url(`/auth/verify-email/${token}`));
    const real = await client.rest(`/auth/verify-email/${token}`, {});

    // Assert
    expect(scan.status).toBe(404);
    expect(real.status).toBeLessThan(300);
  });

  it('answers a replayed link on REST with the stable code', async () => {
    // Arrange
    const { email } = await kit.owner();
    const token = await kit.tokenInMail(email);
    await client.rest(`/auth/verify-email/${token}`, {});

    // Act
    const replay = await client.rest(`/auth/verify-email/${token}`, {});

    // Assert
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({ code: AUTH_ERROR_CODES.INVALID_TOKEN });
  });

  it('verifies by code on REST with the session', async () => {
    // Arrange
    const { email, session } = await kit.owner();
    const code = await kit.codeInMail(email);

    // Act
    const answer = await client.rest('/auth/verify-email-otp', { code }, session);

    // Assert
    expect(answer.status).toBeLessThan(300);
    expect(await kit.status(session)).toMatchObject({ emailVerified: true });
  });

  it('asks no verification of an administrator outside any business', async () => {
    // Arrange
    const email = uniqueEmail();
    const { adminClient } = kit;
    await createTestAdministrator(adminClient, email, PASSWORD);
    const session = await kit.session(email);

    // Act
    const status = await kit.status(session);

    // Assert
    expect(status).toMatchObject({ verificationRequired: false });
  });

  it.each([
    ['verifyEmailOtp', VERIFY_OTP, { code: WRONG_CODE }],
    ['resendEmailVerification', RESEND, {}],
    ['accountStatus', STATUS, {}],
  ])('refuses %s to an anonymous caller', async (_name, query, variables) => {
    // Act
    const answer = await client.graphql(query, variables);

    // Assert
    expect(codeOf(answer)).toBe('FORBIDDEN');
  });
});
