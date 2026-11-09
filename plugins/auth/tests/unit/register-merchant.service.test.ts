import { describe, expect, it, vi } from 'vitest';
import type { IssuedAccountToken } from '../../application/account-token.service';
import { RegisterMerchantService, type RegisterMerchantPorts } from '../../application/register-merchant.service';
import type { AuthEmailRequest } from '../../domain/email';
import {
  ChallengeFailedError,
  EmailTakenError,
  PasswordPolicyError,
  RegistrationInvalidError,
} from '../../domain/errors';
import type { BotChallengeOutcome } from '../../domain/ports/bot-challenge.port';
import type { OperationContext } from '../../domain/ports/operation-context';

const CTX = {} as OperationContext;
const TRANSACTIONAL = { transactional: true } as unknown as OperationContext;
const VALID = {
  email: '  Owner@Example.TEST ',
  password: 'synthetic-owner-password',
  firstName: 'Sara',
  lastName: 'Owner',
  businessName: 'Sara SARL',
  storeName: 'Sara store',
  subdomain: 'sara',
  storeLanguage: 'ar',
  emailLocale: 'en',
};

function harness(options: { challenge?: BotChallengeOutcome; taken?: boolean } = {}) {
  const calls: string[] = [];
  const emails: AuthEmailRequest[] = [];
  const track = <T>(name: string, value: T) =>
    vi.fn(() => {
      calls.push(name);
      return Promise.resolve(value);
    });
  const issued: IssuedAccountToken = { token: 'raw-token', otp: '123456' };
  const mocks = {
    verify: track('challenge', options.challenge ?? 'passed'),
    inTransaction: vi.fn(
      (_ctx: OperationContext, work: (t: OperationContext) => Promise<unknown>): Promise<unknown> => {
        calls.push('begin');
        return work(TRANSACTIONAL);
      },
    ),
    isEmailTaken: track('duplicate-check', options.taken ?? false),
    setEmailLocale: track('set-locale', undefined),
    userIdOfAdministrator: track('user-of', 41),
    claim: track('claim', undefined),
    provision: track('provision', { business: { id: 'b1' }, store: { id: 's1' }, administratorId: 7 } as never),
    issue: track('issue', issued),
    enqueue: vi.fn((_ctx: OperationContext, request: AuthEmailRequest) => {
      calls.push('enqueue');
      emails.push(request);
      return Promise.resolve();
    }),
  };
  const ports: RegisterMerchantPorts = {
    challenge: { verify: mocks.verify },
    identity: {
      inTransaction: <T>(ctx: OperationContext, work: (t: OperationContext) => Promise<T>) =>
        mocks.inTransaction(ctx, work) as Promise<T>,
      isEmailTaken: mocks.isEmailTaken,
      setEmailLocale: mocks.setEmailLocale,
      userIdOfAdministrator: mocks.userIdOfAdministrator,
    },
    claims: { claim: mocks.claim },
    provisioner: { provision: mocks.provision },
    tokens: { issue: mocks.issue },
    emails: { enqueue: mocks.enqueue },
    dashboardUrl: 'https://dash.example.test/dashboard/',
  };
  return { service: new RegisterMerchantService(ports), mocks, calls, emails };
}

describe('RegisterMerchantService', () => {
  it('runs the steps in order, with everything after the challenge in one transaction', async () => {
    // Arrange
    const { service, calls } = harness();

    // Act
    await service.register(CTX, VALID);

    // Assert
    expect(calls).toEqual([
      'challenge',
      'begin',
      'claim',
      'duplicate-check',
      'provision',
      'set-locale',
      'user-of',
      'issue',
      'enqueue',
    ]);
  });

  it('claims and checks the normalised email', async () => {
    // Arrange
    const { service, mocks } = harness();

    // Act
    await service.register(CTX, VALID);

    // Assert
    expect(mocks.claim).toHaveBeenCalledWith(TRANSACTIONAL, 'owner@example.test');
    expect(mocks.isEmailTaken).toHaveBeenCalledWith(TRANSACTIONAL, 'owner@example.test');
  });

  it('hands the email service the transactional context and every variable of the template', async () => {
    // Arrange
    const { service, mocks, emails } = harness();

    // Act
    const result = await service.register(CTX, VALID);

    // Assert
    expect(mocks.enqueue).toHaveBeenCalledWith(TRANSACTIONAL, expect.anything());
    expect(emails[0]).toEqual({
      kind: 'verification',
      to: 'owner@example.test',
      locale: 'en',
      vars: {
        name: 'Sara',
        link: 'https://dash.example.test/dashboard/verify-email?token=raw-token',
        code: '123456',
      },
    });
    expect(result).toEqual({ businessId: 'b1', storeId: 's1', verificationEmailSent: true });
  });

  it('issues a verification token with a code, for the owner user', async () => {
    // Arrange
    const { service, mocks } = harness();

    // Act
    await service.register(CTX, VALID);

    // Assert
    expect(mocks.issue).toHaveBeenCalledWith(
      TRANSACTIONAL,
      expect.objectContaining({ userId: 41, purpose: 'email-verification', withOtp: true }),
    );
  });

  it('sends a language without email templates the default Arabic mail', async () => {
    // Arrange
    const { service, mocks, emails } = harness();

    // Act
    await service.register(CTX, { ...VALID, storeLanguage: 'fr', emailLocale: undefined });

    // Assert
    expect(emails[0]?.locale).toBe('ar');
    expect(mocks.setEmailLocale).toHaveBeenCalledWith(TRANSACTIONAL, 7, 'ar');
  });

  it('refuses a taken email without provisioning', async () => {
    // Arrange
    const { service, mocks } = harness({ taken: true });

    // Act
    const registering = service.register(CTX, VALID);

    // Assert
    await expect(registering).rejects.toBeInstanceOf(EmailTakenError);
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('refuses a failed challenge before the transaction', async () => {
    // Arrange
    const { service, mocks } = harness({ challenge: 'failed' });

    // Act
    const registering = service.register(CTX, VALID);

    // Assert
    await expect(registering).rejects.toBeInstanceOf(ChallengeFailedError);
    expect(mocks.inTransaction).not.toHaveBeenCalled();
  });

  it('proceeds when the challenge provider is unavailable', async () => {
    // Arrange
    const { service } = harness({ challenge: 'unavailable' });

    // Act
    const result = await service.register(CTX, VALID);

    // Assert
    expect(result.verificationEmailSent).toBe(true);
  });

  it('answers a weak password with the password policy code, before the challenge', async () => {
    // Arrange
    const { service, mocks } = harness();

    // Act
    const registering = service.register(CTX, { ...VALID, password: 'short' });

    // Assert
    await expect(registering).rejects.toBeInstanceOf(PasswordPolicyError);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('names only the invalid fields, never their values', async () => {
    // Arrange
    const { service } = harness();

    // Act
    const failure = await service.register(CTX, { ...VALID, email: 'secret-looking-value' }).catch((e: unknown) => e);

    // Assert
    expect(failure).toBeInstanceOf(RegistrationInvalidError);
    expect((failure as Error).message).toContain('email');
    expect((failure as Error).message).not.toContain('secret-looking-value');
  });

  it('answers a missing password as an invalid registration, not a weak one', async () => {
    // Arrange
    const { service } = harness();

    // Act
    const registering = service.register(CTX, { ...VALID, password: undefined });

    // Assert
    await expect(registering).rejects.toBeInstanceOf(RegistrationInvalidError);
  });

  it('refuses a body that is not an object', async () => {
    // Arrange
    const { service } = harness();

    // Act
    const registering = service.register(CTX, 'nonsense');

    // Assert
    await expect(registering).rejects.toBeInstanceOf(RegistrationInvalidError);
  });
});
