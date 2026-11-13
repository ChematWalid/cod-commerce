import { OTP_MAX_ATTEMPTS, VERIFY_LINK_TTL_MS } from '@cod/shared';
import { PLUGIN_TEST_INITIAL_DATA } from '@cod/testing';
import { RequestContext, TransactionalConnection } from '@vendure/core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import type { AccountToken } from '../../domain/account-token';
import { InvalidTokenError, OtpInvalidError, OtpLockedError } from '../../domain/errors';
import type { OperationContext } from '../../domain/ports/operation-context';
import { AccountTokenEntity } from '../../infrastructure/account-token.entity';
import { HmacSecretHasher } from '../../infrastructure/hmac-secret-hasher';
import { TypeOrmAccountTokenRepository } from '../../infrastructure/typeorm-account-token.repository';
import { createAuthTestEnvironment } from './auth-test-environment';

const TOKEN_SECRET = 'integration-test-only-secret-0000000000';
const CONCURRENT_GUESSES = 20;
const USER = 41;
const WRONG_OTP = '000000';

const { server } = createAuthTestEnvironment(TOKEN_SECRET, { poolSize: 30 });

class CountingHasher extends HmacSecretHasher {
  comparisons = 0;

  override matches(secret: string, expectedHash: string): boolean {
    this.comparisons += 1;
    return super.matches(secret, expectedHash);
  }
}

let ctx: OperationContext;
let connection: TransactionalConnection;
let hasher: CountingHasher;
let service: AccountTokenService;
let nextId = 1000;

const rows = () => connection.rawConnection.getRepository(AccountTokenEntity);
const failureOf = (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

beforeAll(async () => {
  await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA, customerCount: 0 });
  connection = server.app.get(TransactionalConnection);
  ctx = RequestContext.empty() as unknown as OperationContext;
});

afterAll(async () => {
  await server.destroy();
});

beforeEach(async () => {
  await rows().clear();
  hasher = new CountingHasher(TOKEN_SECRET);
  service = new AccountTokenService(
    new TypeOrmAccountTokenRepository(connection),
    hasher,
    { next: () => String((nextId += 1)) },
    { now: () => new Date() },
  );
});

const issueVerification = async (): Promise<{ token: string; otp: string }> => {
  const { token, otp } = await service.issue(ctx, {
    userId: USER,
    purpose: 'email-verification',
    ttlMs: VERIFY_LINK_TTL_MS,
    withOtp: true,
  });
  if (otp === undefined) throw new Error('issued without a code');
  return { token, otp };
};

/** Match then consume, as a caller with no follow-up write would. */
const guessAndConsume = async (on: OperationContext, userId: number, otp: string): Promise<AccountToken> =>
  service.consumeMatchedOtp(on, await service.matchOtp(userId, otp));

const attemptsOf = async (): Promise<AccountTokenEntity> => rows().findOneByOrFail({ userId: USER });

describe('one-time codes under concurrency', () => {
  it('counts exactly the allowed guesses and compares no more than that', async () => {
    // Arrange
    await issueVerification();

    // Act
    const failures = await Promise.all(
      Array.from({ length: CONCURRENT_GUESSES }, () => failureOf(guessAndConsume(ctx, USER, WRONG_OTP))),
    );

    // Assert
    const row = await attemptsOf();
    expect(row.otpAttempts).toBe(OTP_MAX_ATTEMPTS);
    expect(row.otpLockedAt).not.toBeNull();
    expect(hasher.comparisons).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    expect(failures.every((f) => f instanceof OtpInvalidError || f instanceof OtpLockedError)).toBe(true);
    expect(failures.filter((f) => f instanceof OtpLockedError).length).toBe(CONCURRENT_GUESSES - OTP_MAX_ATTEMPTS + 1);
  });

  it('never lets a right code through past the last allowed guess', async () => {
    // Arrange
    const { otp } = await issueVerification();
    const guesses = Array.from({ length: CONCURRENT_GUESSES + 1 }, (_, index) => (index === 10 ? otp : WRONG_OTP));

    // Act
    const results = await Promise.all(guesses.map((guess) => failureOf(guessAndConsume(ctx, USER, guess))));

    // Assert: the right code either took one of the five slots and consumed the row, or was refused.
    const row = await attemptsOf();
    const succeeded = results[10] === undefined;
    expect(row.otpAttempts).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    expect(hasher.comparisons).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    expect(row.consumedAt !== null).toBe(succeeded);
    expect(results.filter((result) => result === undefined).length).toBe(succeeded ? 1 : 0);
  });

  it('refuses the right code when the guesses are already spent', async () => {
    // Arrange
    const { otp } = await issueVerification();
    await Promise.all(
      Array.from({ length: CONCURRENT_GUESSES }, () => failureOf(guessAndConsume(ctx, USER, WRONG_OTP))),
    );

    // Act
    const failure = await failureOf(guessAndConsume(ctx, USER, otp));

    // Assert
    expect(failure).toBeInstanceOf(OtpLockedError);
    expect((await attemptsOf()).consumedAt).toBeNull();
  });

  it('keeps a wrong guess counted when the caller transaction rolls back', async () => {
    // Arrange
    await issueVerification();

    // Act
    const failure = await failureOf(
      connection.withTransaction(RequestContext.empty(), (transactional) =>
        guessAndConsume(transactional as unknown as OperationContext, USER, WRONG_OTP),
      ),
    );

    // Assert
    expect(failure).toBeInstanceOf(OtpInvalidError);
    expect((await attemptsOf()).otpAttempts).toBe(1);
  });

  it('rolls a successful consumption back with the caller transaction', async () => {
    // Arrange
    const { otp } = await issueVerification();

    // Act
    await failureOf(
      connection.withTransaction(RequestContext.empty(), async (transactional) => {
        await guessAndConsume(transactional as unknown as OperationContext, USER, otp);
        throw new Error('later step failed');
      }),
    );

    // Assert
    expect((await attemptsOf()).consumedAt).toBeNull();
  });
});

describe('link tokens', () => {
  it('lets exactly one of 20 concurrent uses of a token succeed', async () => {
    // Arrange
    const { token } = await issueVerification();

    // Act
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_GUESSES }, () => failureOf(service.consume(ctx, 'email-verification', token))),
    );

    // Assert
    expect(results.filter((result) => result === undefined)).toHaveLength(1);
  });

  it('never stores the raw token or code', async () => {
    // Arrange
    const { token, otp } = await issueVerification();

    // Act
    const row = await attemptsOf();

    // Assert
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.otpHash).not.toBe(otp);
    expect(row.tokenHash).toHaveLength(64);
    expect(row.tokenHash).toBe(new HmacSecretHasher(TOKEN_SECRET).hash(token));
  });

  it('leaves one open token when 20 issues race', async () => {
    // Act
    await Promise.all(Array.from({ length: CONCURRENT_GUESSES }, () => issueVerification()));

    // Assert
    expect(await rows().count()).toBe(CONCURRENT_GUESSES);
    const stillOpen = await connection.rawConnection.query<{ open: string }[]>(
      'SELECT count(*) AS open FROM account_token WHERE "consumedAt" IS NULL',
    );
    expect(stillOpen[0]?.open).toBe('1');
  });

  it('allows a null user only for an oauth ticket', async () => {
    // Act
    const refused = await failureOf(service.issue(ctx, { userId: null, purpose: 'password-reset', ttlMs: 1000 }));
    const ticket = await failureOf(service.issue(ctx, { userId: null, purpose: 'oauth-ticket', ttlMs: 1000 }));

    // Assert
    expect(refused).toMatchObject({ driverError: { constraint: 'account_token_user_required' } });
    expect(ticket).toBeUndefined();
  });

  it('does not void other oauth tickets when issuing one', async () => {
    // Arrange
    const first = await service.issue(ctx, { userId: null, purpose: 'oauth-ticket', ttlMs: 60_000 });

    // Act
    await service.issue(ctx, { userId: null, purpose: 'oauth-ticket', ttlMs: 60_000 });

    // Assert
    await expect(service.consume(ctx, 'oauth-ticket', first.token)).resolves.toBeDefined();
  });

  it('voids open tokens and reports the last issue', async () => {
    // Arrange
    const { token } = await issueVerification();

    // Act
    await service.voidOpen(ctx, USER, ['email-verification']);

    // Assert
    expect(await failureOf(service.consume(ctx, 'email-verification', token))).toBeInstanceOf(InvalidTokenError);
    await expect(service.lastIssuedAt(ctx, USER, 'email-verification')).resolves.toBeInstanceOf(Date);
  });
});
