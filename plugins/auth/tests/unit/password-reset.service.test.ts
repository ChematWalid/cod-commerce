import { describe, expect, it } from 'vitest';
import { AuthEmailService } from '../../application/auth-email.service';
import { PasswordResetService, type PasswordResetPorts } from '../../application/password-reset.service';
import type { AuthEmailRequest } from '../../domain/email';
import { InvalidTokenError } from '../../domain/errors';
import type { AccountRecord } from '../../domain/ports/account-identity.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { RecordingQueue } from '../fakes/recording-email';

const CTX = {} as OperationContext;
const RESET_TOKEN = 'synthetic-reset-token';
const NEW_PASSWORD = 'synthetic-replacement-password';
const ACCOUNT: AccountRecord = {
  userId: 7,
  administratorId: 3,
  firstName: 'Sara',
  email: 'owner@example.test',
  locale: 'ar',
  emailVerifiedAt: new Date('2026-11-01T00:00:00Z'),
  providerLinkUnproven: false,
  businessId: 'business-a',
};

const plainSealer = {
  seal: (value: unknown) => JSON.stringify(value),
  open: (value: string) => JSON.parse(value) as unknown,
};

function serviceWith(consumedUserId: number | null): { service: PasswordResetService; queue: RecordingQueue } {
  const queue = new RecordingQueue();
  const ports = {
    identity: {
      inTransaction: <T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>) => work(ctx),
      findByUserId: (_ctx: OperationContext, userId: number) =>
        Promise.resolve(userId === ACCOUNT.userId ? ACCOUNT : undefined),
    },
    passwords: { set: () => Promise.resolve() },
    sessions: {
      open: () => Promise.resolve({ token: 'session', id: '1', identifier: ACCOUNT.email, channels: [] }),
    },
    terminator: { endOthers: () => Promise.resolve([]), flushCache: () => Promise.resolve() },
    throttle: { clearLoginLockout: () => Promise.resolve() },
    tokens: { consume: () => Promise.resolve({ userId: consumedUserId }), voidOpen: () => Promise.resolve() },
    emails: new AuthEmailService(queue, plainSealer),
  } as unknown as PasswordResetPorts;
  return { service: new PasswordResetService(ports), queue };
}

const queuedRequests = (queue: RecordingQueue): AuthEmailRequest[] =>
  queue.queued.map((sealed) => JSON.parse(sealed) as AuthEmailRequest);

describe('PasswordResetService.reset', () => {
  it('queues exactly one password-changed notice to the account email, in its locale', async () => {
    // Arrange
    const { service, queue } = serviceWith(ACCOUNT.userId);

    // Act
    await service.reset(CTX, RESET_TOKEN, NEW_PASSWORD);

    // Assert
    expect(queuedRequests(queue)).toEqual([
      { kind: 'password-changed', to: ACCOUNT.email, locale: ACCOUNT.locale, vars: { name: ACCOUNT.firstName } },
    ]);
  });

  it('queues no notice when the token belongs to no account', async () => {
    // Arrange
    const { service, queue } = serviceWith(null);

    // Act
    const reset = service.reset(CTX, RESET_TOKEN, NEW_PASSWORD);

    // Assert
    await expect(reset).rejects.toBeInstanceOf(InvalidTokenError);
    expect(queue.queued).toHaveLength(0);
  });
});
