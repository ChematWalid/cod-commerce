import { ClientIpResolver, RATE_LIMIT_POLICIES, RATE_LIMITED_CODE } from '@cod/plugin-rate-limit';
import { OTP_TTL_MS } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccountTokenService } from '../../application/account-token.service';
import { AuthEmailService } from '../../application/auth-email.service';
import { EmailVerificationService } from '../../application/email-verification.service';
import type { AccountRecord } from '../../domain/ports/account-identity.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { AccountThrottle } from '../../infrastructure/account-throttle';
import { FakeSecretHasher } from '../fakes/fake-secret-hasher';
import { InMemoryAccountTokenRepository } from '../fakes/in-memory-account-token.repository';
import { InMemoryRateLimiter } from '../fakes/in-memory-rate-limiter';
import { ManualClock } from '../fakes/manual-clock';
import { RecordingQueue } from '../fakes/recording-email';

const ctx = {} as OperationContext;
const USER_ID = 7;
const USER_KEY = String(USER_ID);
const WRONG = '999999';
const MINUTE_CAPACITY = RATE_LIMIT_POLICIES['otp-account'].capacity;
const DAILY_CAPACITY = RATE_LIMIT_POLICIES['otp-account-daily'].capacity;

const refusalOf = async (work: Promise<unknown>): Promise<unknown> =>
  work.then(
    () => 'resolved',
    (error: unknown) => (error as { code?: string }).code,
  );

/** The service on the real throttle adapter and a limiter whose buckets never refill on their own. */
describe('EmailVerificationService on the account throttle (D29, D44)', () => {
  let limiter: InMemoryRateLimiter;
  let account: AccountRecord;
  let tokens: AccountTokenService;
  let service: EmailVerificationService;

  beforeEach(() => {
    const clock = new ManualClock();
    const hasher = new FakeSecretHasher();
    limiter = new InMemoryRateLimiter();
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
    tokens = new AccountTokenService(new InMemoryAccountTokenRepository(), hasher, nextId, clock);
    const sealer = { seal: (value: unknown) => JSON.stringify(value), open: (value: string) => JSON.parse(value) as unknown };
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
      emails: new AuthEmailService(new RecordingQueue(), sealer),
      throttle: new AccountThrottle(limiter, new ClientIpResolver(''), hasher),
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

  /** A minute passing, as far as the per-minute bucket is concerned: the frozen limiter never refills it. */
  const refillMinuteBucket = async (): Promise<void> => {
    for (let token = 0; token < MINUTE_CAPACITY; token += 1) {
      await limiter.refund('otp-account', USER_KEY);
    }
  };

  it('takes one token from the user’s otp-account and otp-account-daily buckets per guess', async () => {
    // Arrange
    await issueCode();

    // Act
    await refusalOf(service.verifyByCode(ctx, USER_ID, WRONG));

    // Assert
    expect(limiter.remaining('otp-account', USER_KEY)).toBe(MINUTE_CAPACITY - 1);
    expect(limiter.remaining('otp-account-daily', USER_KEY)).toBe(DAILY_CAPACITY - 1);
  });

  it('refuses the eleventh guess in a minute as rate-limited, even for the right code', async () => {
    // Arrange
    const code = await issueCode();
    for (let guess = 0; guess < MINUTE_CAPACITY; guess += 1) {
      await refusalOf(service.verifyByCode(ctx, USER_ID, WRONG));
    }

    // Act
    const refused = await refusalOf(service.verifyByCode(ctx, USER_ID, code));

    // Assert
    expect(refused).toBe(RATE_LIMITED_CODE);
    expect(account.emailVerifiedAt).toBeNull();
  });

  it('refuses the fifty-first guess of a day as rate-limited, whatever the minute bucket holds', async () => {
    // Arrange
    await issueCode();
    for (let guess = 0; guess < DAILY_CAPACITY; guess += 1) {
      await refillMinuteBucket();
      await refusalOf(service.verifyByCode(ctx, USER_ID, WRONG));
    }
    await refillMinuteBucket();

    // Act
    const refused = await refusalOf(service.verifyByCode(ctx, USER_ID, WRONG));

    // Assert
    expect(refused).toBe(RATE_LIMITED_CODE);
  });
});
