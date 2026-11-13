import { OTP_MAX_ATTEMPTS, VERIFY_LINK_TTL_MS } from '@cod/shared';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import { EmailVerificationService } from '../../application/email-verification.service';
import { OtpInvalidError, OtpLockedError } from '../../domain/errors';
import type { OperationContext } from '../../domain/ports/operation-context';
import { AccountTokenEntity } from '../../infrastructure/account-token.entity';
import { HmacSecretHasher } from '../../infrastructure/hmac-secret-hasher';
import { TypeOrmAccountTokenRepository } from '../../infrastructure/typeorm-account-token.repository';
import { VendureAccountIdentity } from '../../infrastructure/vendure-account-identity';
import { createAuthTestEnvironment } from './auth-test-environment';
import { createTestAdministrator } from './create-test-administrator';
import { PASSWORD, uniqueEmail } from './register-test-kit';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const CONCURRENT_GUESSES = 20;
const RIGHT_GUESS_INDEX = 2;
const RIGHT_COPIES = 2;
/** Every guess fits under the cap, so a right copy is never refused for lack of tries, only by its twin. */
const WRONG_GUESSES_UNDER_CAP = OTP_MAX_ATTEMPTS - RIGHT_COPIES;
const WRONG_OTP = '000000';

const { server, adminClient } = createAuthTestEnvironment(TOKEN_SECRET, { poolSize: 30 });

class CountingHasher extends HmacSecretHasher {
  comparisons = 0;

  override matches(secret: string, expectedHash: string): boolean {
    this.comparisons += 1;
    return super.matches(secret, expectedHash);
  }
}

class VerifiedWriteFailedError extends Error {}

let ctx: OperationContext;
let connection: TransactionalConnection;
let identity: VendureAccountIdentity;
let hasher: CountingHasher;
let tokens: AccountTokenService;
let service: EmailVerificationService;
let userId: number;
let verifiedWrites: number;
let failVerifiedWrite: boolean;
let nextId = 5000;

const rows = () => connection.rawConnection.getRepository(AccountTokenEntity);
const tokenRow = async (): Promise<AccountTokenEntity> => rows().findOneByOrFail({ userId });
const failureOf = (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  connection = server.app.get(TransactionalConnection);
  identity = server.app.get(VendureAccountIdentity);
  ctx = RequestContext.empty() as unknown as OperationContext;
});

afterAll(async () => {
  await server.destroy();
});

/** The real token store and account writes on Postgres; the throttle is open so only the token rules count. */
beforeEach(async () => {
  const email = uniqueEmail();
  await createTestAdministrator(adminClient, email, PASSWORD);
  const account = await identity.findByEmail(ctx, email);
  if (account === undefined) throw new Error('administrator not created');
  userId = account.userId;
  verifiedWrites = 0;
  failVerifiedWrite = false;
  hasher = new CountingHasher(TOKEN_SECRET);
  tokens = new AccountTokenService(
    new TypeOrmAccountTokenRepository(connection),
    hasher,
    { next: () => String((nextId += 1)) },
    { now: () => new Date() },
  );
  service = new EmailVerificationService({
    identity: {
      inTransaction: (operation, work) => identity.inTransaction(operation, work),
      findByUserId: (operation, id) => identity.findByUserId(operation, id),
      markEmailVerified: async (operation, administratorId, at) => {
        if (failVerifiedWrite) throw new VerifiedWriteFailedError();
        verifiedWrites += 1;
        await identity.markEmailVerified(operation, administratorId, at);
      },
    },
    tokens,
    emails: { enqueue: () => Promise.resolve() },
    throttle: { spendForUser: () => Promise.resolve() },
    clock: { now: () => new Date() },
    dashboardUrl: 'https://dash.example.test',
  });
});

const issueCode = async (): Promise<string> => {
  const { otp } = await tokens.issue(ctx, {
    userId,
    purpose: 'email-verification',
    ttlMs: VERIFY_LINK_TTL_MS,
    withOtp: true,
  });
  if (otp === undefined) throw new Error('issued without a code');
  return otp;
};

const isVerified = async (): Promise<boolean> => (await identity.findByUserId(ctx, userId))?.emailVerifiedAt != null;

describe('verifying an email by code under concurrency (AUTH-9)', () => {
  it('counts no more than the allowed tries when wrong codes arrive in parallel, then locks', async () => {
    // Arrange
    await issueCode();

    // Act
    const failures = await Promise.all(
      Array.from({ length: CONCURRENT_GUESSES }, () => failureOf(service.verifyByCode(ctx, userId, WRONG_OTP))),
    );

    // Assert
    const row = await tokenRow();
    expect(row.otpAttempts).toBe(OTP_MAX_ATTEMPTS);
    expect(row.otpLockedAt).not.toBeNull();
    expect(hasher.comparisons).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    expect(failures.every((f) => f instanceof OtpInvalidError || f instanceof OtpLockedError)).toBe(true);
    expect(await isVerified()).toBe(false);
  });

  it('verifies exactly once and consumes the token once when the right code races wrong ones', async () => {
    // Arrange
    const code = await issueCode();
    const guesses = [
      ...Array.from({ length: RIGHT_COPIES }, () => code),
      ...Array.from({ length: WRONG_GUESSES_UNDER_CAP }, () => WRONG_OTP),
    ];

    // Act
    const results = await Promise.all(guesses.map((guess) => failureOf(service.verifyByCode(ctx, userId, guess))));

    // Assert: a guess that lands after the winner finds no open code and is not counted, so only the cap is checked.
    const row = await tokenRow();
    const failures = results.filter((result) => result !== undefined);
    expect(results.length - failures.length).toBe(1);
    expect(verifiedWrites).toBe(1);
    expect(row.consumedAt).not.toBeNull();
    expect(row.otpAttempts).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    expect(failures.every((f) => f instanceof OtpInvalidError || f instanceof OtpLockedError)).toBe(true);
    expect(await isVerified()).toBe(true);
  });

  it('never verifies twice nor counts past the cap when the right code races a burst of wrong ones', async () => {
    // Arrange
    const code = await issueCode();
    const guesses = Array.from({ length: CONCURRENT_GUESSES }, (_, index) =>
      index === RIGHT_GUESS_INDEX || index === RIGHT_GUESS_INDEX + 1 ? code : WRONG_OTP,
    );

    // Act
    const results = await Promise.all(guesses.map((guess) => failureOf(service.verifyByCode(ctx, userId, guess))));

    // Assert: the wrong guesses may spend every try first, so the right code may lose; it never wins twice.
    const row = await tokenRow();
    const successes = results.filter((result) => result === undefined).length;
    expect(row.otpAttempts).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    expect(successes).toBeLessThanOrEqual(1);
    expect(row.consumedAt !== null).toBe(successes === 1);
    expect(verifiedWrites).toBe(successes);
    expect(await isVerified()).toBe(successes === 1);
  });

  it('rolls the token back with a failed verified write, so the same code works on retry', async () => {
    // Arrange
    const code = await issueCode();
    failVerifiedWrite = true;
    const failed = await failureOf(service.verifyByCode(ctx, userId, code));
    const afterFailure = await tokenRow();
    failVerifiedWrite = false;

    // Act
    const retried = await failureOf(service.verifyByCode(ctx, userId, code));

    // Assert
    expect(failed).toBeInstanceOf(VerifiedWriteFailedError);
    expect(afterFailure.consumedAt).toBeNull();
    expect(afterFailure.otpAttempts).toBe(1);
    expect(retried).toBeUndefined();
    expect((await tokenRow()).consumedAt).not.toBeNull();
    expect(await isVerified()).toBe(true);
  });
});
