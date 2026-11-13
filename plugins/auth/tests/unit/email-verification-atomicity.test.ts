import { AUTH_ERROR_CODES, OTP_TTL_MS } from '@cod/shared';
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

const refusalOf = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => 'resolved',
    (error: unknown) => (error as { code?: string }).code ?? error,
  );

class VerifiedWriteFailedError extends Error {}

/** Verifying by code, where the token write and the "verified" write must commit or roll back together (AUTH-9). */
describe('EmailVerificationService.verifyByCode atomicity', () => {
  let clock: ManualClock;
  let account: AccountRecord;
  let repository: InMemoryAccountTokenRepository;
  let tokens: AccountTokenService;
  let service: EmailVerificationService;
  let failVerifiedWrite: boolean;

  beforeEach(() => {
    failVerifiedWrite = false;
    clock = new ManualClock();
    repository = new InMemoryAccountTokenRepository();
    account = {
      userId: USER_ID,
      administratorId: 3,
      firstName: 'Sara',
      email: 'sara@example.test',
      locale: 'ar',
      emailVerifiedAt: null,
      providerLinkUnproven: false,
      businessId: '1',
    };
    let ids = 0;
    const nextId = {
      next: (): string => {
        ids += 1;
        return String(ids);
      },
    };
    tokens = new AccountTokenService(repository, new FakeSecretHasher(), nextId, clock);
    const sealer = { seal: (value: unknown) => JSON.stringify(value), open: (value: string) => JSON.parse(value) as unknown };
    service = new EmailVerificationService({
      identity: {
        // A transaction over the in-memory rows: what the work wrote is undone when it throws.
        inTransaction: async (_ctx, work) => {
          const before = repository.rows;
          try {
            return await work(ctx);
          } catch (error: unknown) {
            repository.rows = before;
            throw error;
          }
        },
        findByUserId: () => Promise.resolve(account),
        markEmailVerified: () => {
          if (failVerifiedWrite) {
            return Promise.reject(new VerifiedWriteFailedError());
          }
          account = { ...account, emailVerifiedAt: clock.now() };
          return Promise.resolve();
        },
      },
      tokens,
      emails: new AuthEmailService(new RecordingQueue(), sealer),
      throttle: { spendForUser: () => Promise.resolve() },
      clock,
      dashboardUrl: 'https://dash.example.test',
    });
  });

  const issueCode = async (): Promise<string> => {
    const { otp } = await tokens.issue(ctx, {
      userId: USER_ID,
      purpose: 'email-verification',
      ttlMs: OTP_TTL_MS,
      withOtp: true,
    });
    return otp ?? '';
  };

  it('leaves the right code usable when marking the email verified fails', async () => {
    // Arrange
    const code = await issueCode();
    failVerifiedWrite = true;
    const failed = await refusalOf(service.verifyByCode(ctx, USER_ID, code));
    failVerifiedWrite = false;

    // Act
    const retried = await refusalOf(service.verifyByCode(ctx, USER_ID, code));

    // Assert
    expect(failed).toBeInstanceOf(VerifiedWriteFailedError);
    expect(retried).toBe('resolved');
    expect(account.emailVerifiedAt).not.toBeNull();
  });

  it('keeps the failed attempt counted when the verified write rolls back', async () => {
    // Arrange
    const code = await issueCode();
    failVerifiedWrite = true;

    // Act
    await refusalOf(service.verifyByCode(ctx, USER_ID, code));

    // Assert
    expect(repository.rows[0]?.otpAttempts).toBe(1);
    expect(repository.rows[0]?.consumedAt).toBeNull();
  });

  it('verifies once: a replay of the right code is refused', async () => {
    // Arrange
    const code = await issueCode();
    await service.verifyByCode(ctx, USER_ID, code);

    // Act
    const replay = await refusalOf(service.verifyByCode(ctx, USER_ID, code));

    // Assert
    expect(replay).toBe(AUTH_ERROR_CODES.OTP_INVALID);
    expect(repository.rows[0]?.consumedAt).not.toBeNull();
  });
});
