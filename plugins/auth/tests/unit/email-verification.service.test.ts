import { AUTH_ERROR_CODES, OTP_MAX_ATTEMPTS, OTP_TTL_MS, RESEND_COOLDOWN_MS } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import { AuthEmailService } from '../../application/auth-email.service';
import { EmailVerificationService } from '../../application/email-verification.service';
import type { AccountRecord } from '../../domain/ports/account-identity.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { FakeSecretHasher } from '../fakes/fake-secret-hasher';
import { InMemoryAccountTokenRepository } from '../fakes/in-memory-account-token.repository';
import { ManualClock } from '../fakes/manual-clock';
import { RecordingQueue } from '../fakes/recording-email';

const ctx = {} as OperationContext;
const USER_ID = 7;
const WRONG = '999999';

const refusalOf = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => 'resolved',
    (error: unknown) => (error as { code?: string }).code,
  );

describe('EmailVerificationService', () => {
  let clock: ManualClock;
  let account: AccountRecord;
  let hasher: FakeSecretHasher;
  let service: EmailVerificationService;
  let tokens: AccountTokenService;

  beforeEach(() => {
    clock = new ManualClock();
    hasher = new FakeSecretHasher();
    account = {
      userId: USER_ID,
      administratorId: 3,
      firstName: 'Sara',
      email: 'sara@example.test',
      locale: 'ar',
      emailVerifiedAt: null,
      businessId: '1',
    };
    let ids = 0;
    tokens = new AccountTokenService(
      new InMemoryAccountTokenRepository(),
      hasher,
      {
        next: () => {
          ids += 1;
          return String(ids);
        },
      },
      clock,
    );
    const queue = new RecordingQueue();
    const sealer = {
      seal: (value: unknown) => JSON.stringify(value),
      open: (value: string) => JSON.parse(value) as unknown,
    };
    service = new EmailVerificationService({
      identity: {
        inTransaction: (_ctx, work) => work(ctx),
        findByUserId: () => Promise.resolve(account),
        markEmailVerified: () => {
          account = { ...account, emailVerifiedAt: clock.now() };
          return Promise.resolve();
        },
      },
      tokens,
      emails: new AuthEmailService(queue, sealer),
      throttle: { spendForUser: () => Promise.resolve() },
      clock,
      dashboardUrl: 'https://dash.example.test',
    });
  });

  const issue = (): Promise<{ token: string; otp?: string }> =>
    tokens.issue(ctx, { userId: USER_ID, purpose: 'email-verification', ttlMs: 2 * OTP_TTL_MS, withOtp: true });

  it('refuses a code after its ten minutes while the link in the same row still works', async () => {
    // Arrange
    const { token, otp } = await issue();
    clock.advance(OTP_TTL_MS + 1);

    // Act
    const expired = await refusalOf(service.verifyByCode(ctx, USER_ID, otp ?? ''));
    await service.verifyByLink(ctx, token);

    // Assert
    expect(expired).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(account.emailVerifiedAt).not.toBeNull();
  });

  it('locks the code after the allowed wrong guesses, even for the right code', async () => {
    // Arrange
    const { otp } = await issue();
    for (let tried = 0; tried < OTP_MAX_ATTEMPTS; tried += 1) {
      await refusalOf(service.verifyByCode(ctx, USER_ID, WRONG));
    }

    // Act
    const refused = await refusalOf(service.verifyByCode(ctx, USER_ID, otp ?? ''));

    // Assert
    expect(refused).toBe(AUTH_ERROR_CODES.OTP_LOCKED);
    expect(account.emailVerifiedAt).toBeNull();
  });

  it('refuses a resend inside the cooldown and allows it after', async () => {
    // Arrange
    await issue();

    // Act
    const early = await refusalOf(service.resend(ctx, USER_ID));
    clock.advance(RESEND_COOLDOWN_MS);
    const result = await service.resend(ctx, USER_ID);

    // Assert
    expect(early).toBe(AUTH_ERROR_CODES.COOLDOWN);
    expect(result.nextAllowedAt.getTime() - result.sentAt.getTime()).toBe(RESEND_COOLDOWN_MS);
  });

  it('reports when a resend opens, and null once it has', async () => {
    // Arrange
    await issue();

    // Act
    const during = await service.status(ctx, USER_ID);
    clock.advance(RESEND_COOLDOWN_MS);
    const after = await service.status(ctx, USER_ID);

    // Assert
    expect(during.resendAvailableAt?.getTime()).toBe(clock.now().getTime());
    expect(after.resendAvailableAt).toBeNull();
  });
});
