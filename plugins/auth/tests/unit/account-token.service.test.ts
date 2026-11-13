import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, RESET_TOKEN_TTL_MS, VERIFY_LINK_TTL_MS } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import { InvalidTokenError, OtpInvalidError, OtpLockedError } from '../../domain/errors';
import type { OperationContext } from '../../domain/ports/operation-context';
import { FakeSecretHasher } from '../fakes/fake-secret-hasher';
import { InMemoryAccountTokenRepository } from '../fakes/in-memory-account-token.repository';
import { ManualClock } from '../fakes/manual-clock';

const ctx = {} as OperationContext;
const USER = 7;
const WRONG_OTP = '000000';

const failureOf = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => undefined,
    (error: unknown) => error,
  );

describe('AccountTokenService', () => {
  let repository: InMemoryAccountTokenRepository;
  let hasher: FakeSecretHasher;
  let clock: ManualClock;
  let service: AccountTokenService;

  beforeEach(() => {
    repository = new InMemoryAccountTokenRepository();
    hasher = new FakeSecretHasher();
    clock = new ManualClock();
    let id = 0;
    const ids = { next: (): string => String((id += 1)) };
    service = new AccountTokenService(repository, hasher, ids, clock);
  });

  const issueReset = () => service.issue(ctx, { userId: USER, purpose: 'password-reset', ttlMs: RESET_TOKEN_TTL_MS });
  const issueVerification = () =>
    service.issue(ctx, { userId: USER, purpose: 'email-verification', ttlMs: VERIFY_LINK_TTL_MS, withOtp: true });
  const guessAndConsume = async (on: OperationContext, userId: number, otp: string) =>
    service.consumeMatchedOtp(on, await service.matchOtp(userId, otp));
  const otpOf = async (): Promise<string> => {
    const { otp } = await issueVerification();
    if (otp === undefined) throw new Error('issued without a code');
    return otp;
  };

  it('stores a hash of the token and of the code, never the raw values', async () => {
    // Act
    const { token, otp } = await issueVerification();

    // Assert
    const [row] = repository.rows;
    expect(row?.tokenHash).not.toBe(token);
    expect(row?.otpHash).not.toBe(otp);
    expect(JSON.stringify(row)).not.toContain(`"${token}"`);
  });

  it('issues no code unless asked', async () => {
    // Act
    const issued = await issueReset();

    // Assert
    expect(issued.otp).toBeUndefined();
    expect(repository.rows[0]?.otpHash).toBeNull();
  });

  it('keeps the pending email and the payload', async () => {
    // Act
    await service.issue(ctx, {
      userId: null,
      purpose: 'oauth-ticket',
      ttlMs: 1000,
      pendingEmail: 'new@example.test',
      payload: { provider: 'google' },
    });

    // Assert
    expect(repository.rows[0]).toMatchObject({
      userId: null,
      pendingEmail: 'new@example.test',
      payload: { provider: 'google' },
    });
  });

  it('consumes a token once; the second use is invalid', async () => {
    // Arrange
    const { token } = await issueReset();

    // Act
    const consumed = await service.consume(ctx, 'password-reset', token);
    const second = await failureOf(service.consume(ctx, 'password-reset', token));

    // Assert
    expect(consumed.userId).toBe(USER);
    expect(second).toBeInstanceOf(InvalidTokenError);
  });

  it('refuses unknown, expired and other-purpose tokens with the same class and message', async () => {
    // Arrange
    const { token } = await issueReset();
    const otherPurpose = await failureOf(service.consume(ctx, 'email-change', token));
    const unknown = await failureOf(service.consume(ctx, 'password-reset', 'no-such-token'));
    clock.advance(RESET_TOKEN_TTL_MS + 1);

    // Act
    const expired = await failureOf(service.consume(ctx, 'password-reset', token));

    // Assert
    expect(expired).toBeInstanceOf(InvalidTokenError);
    expect(unknown).toBeInstanceOf(InvalidTokenError);
    expect(otherPurpose).toBeInstanceOf(InvalidTokenError);
    expect((expired as Error).message).toBe((unknown as Error).message);
  });

  it('voids the earlier open token of the purpose when a new one is issued', async () => {
    // Arrange
    const first = await issueReset();
    const second = await issueReset();

    // Act
    const replaced = await failureOf(service.consume(ctx, 'password-reset', first.token));

    // Assert
    expect(replaced).toBeInstanceOf(InvalidTokenError);
    await expect(service.consume(ctx, 'password-reset', second.token)).resolves.toBeDefined();
  });

  it('leaves tokens of other purposes open when issuing', async () => {
    // Arrange
    const reset = await issueReset();

    // Act
    await issueVerification();

    // Assert
    await expect(service.consume(ctx, 'password-reset', reset.token)).resolves.toBeDefined();
  });

  it('voids only the given purposes', async () => {
    // Arrange
    const reset = await issueReset();
    const verification = await issueVerification();

    // Act
    await service.voidOpen(ctx, USER, ['password-reset']);

    // Assert
    expect(await failureOf(service.consume(ctx, 'password-reset', reset.token))).toBeInstanceOf(InvalidTokenError);
    await expect(service.consume(ctx, 'email-verification', verification.token)).resolves.toBeDefined();
  });

  it('accepts the right code and consumes the shared row, so the link is spent too', async () => {
    // Arrange
    const { token, otp } = await issueVerification();

    // Act
    const consumed = await guessAndConsume(ctx, USER, otp ?? '');

    // Assert
    expect(consumed.consumedAt).not.toBeNull();
    expect(await failureOf(service.consume(ctx, 'email-verification', token))).toBeInstanceOf(InvalidTokenError);
  });

  it('refuses a wrong code until the last try, which locks', async () => {
    // Arrange
    await issueVerification();

    // Act
    const failures: unknown[] = [];
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      failures.push(await failureOf(guessAndConsume(ctx, USER, WRONG_OTP)));
    }

    // Assert
    expect(failures.slice(0, -1).every((failure) => failure instanceof OtpInvalidError)).toBe(true);
    expect(failures.at(-1)).toBeInstanceOf(OtpLockedError);
    expect(repository.rows[0]?.otpLockedAt).not.toBeNull();
  });

  it('refuses the right code once locked, without comparing it', async () => {
    // Arrange
    const otp = await otpOf();
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      await failureOf(guessAndConsume(ctx, USER, WRONG_OTP));
    }
    const comparisons = hasher.comparisons;

    // Act
    const failure = await failureOf(guessAndConsume(ctx, USER, otp));

    // Assert
    expect(failure).toBeInstanceOf(OtpLockedError);
    expect(hasher.comparisons).toBe(comparisons);
    expect(repository.rows[0]?.otpAttempts).toBe(OTP_MAX_ATTEMPTS);
  });

  it('accepts the right code on the last try and lifts the lock', async () => {
    // Arrange
    const otp = await otpOf();
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS - 1; attempt += 1) {
      await failureOf(guessAndConsume(ctx, USER, WRONG_OTP));
    }

    // Act
    const consumed = await guessAndConsume(ctx, USER, otp);

    // Assert
    expect(consumed.otpAttempts).toBe(OTP_MAX_ATTEMPTS);
    expect(consumed.otpLockedAt).toBeNull();
  });

  it('expires the code before the link and counts no guess then', async () => {
    // Arrange
    const { token, otp } = await issueVerification();
    clock.advance(OTP_TTL_MS + 1);

    // Act
    const failure = await failureOf(guessAndConsume(ctx, USER, otp ?? ''));

    // Assert
    expect(failure).toBeInstanceOf(OtpInvalidError);
    expect(repository.rows[0]?.otpAttempts).toBe(0);
    await expect(service.consume(ctx, 'email-verification', token)).resolves.toBeDefined();
  });

  it('refuses a code when none was issued', async () => {
    // Act
    const failure = await failureOf(guessAndConsume(ctx, USER, WRONG_OTP));

    // Assert
    expect(failure).toBeInstanceOf(OtpInvalidError);
  });

  it('gives a working code after a lock when a new one is issued', async () => {
    // Arrange
    await issueVerification();
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) {
      await failureOf(guessAndConsume(ctx, USER, WRONG_OTP));
    }
    const otp = await otpOf();

    // Act
    const consumed = await guessAndConsume(ctx, USER, otp);

    // Assert
    expect(consumed.consumedAt).not.toBeNull();
  });

  it('reports when the latest token of a purpose was issued', async () => {
    // Arrange
    await issueReset();
    clock.advance(1000);
    await issueReset();

    // Act
    const issuedAt = await service.lastIssuedAt(ctx, USER, 'password-reset');

    // Assert
    expect(issuedAt).toEqual(clock.now());
    await expect(service.lastIssuedAt(ctx, USER, 'email-change')).resolves.toBeUndefined();
  });
});
