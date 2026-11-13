import { describe, expect, it } from 'vitest';
import { AuthEmailService } from '../../application/auth-email.service';
import { OAuthSignInService, type OAuthSignInPorts } from '../../application/oauth-sign-in.service';
import type { AuthEmailRequest } from '../../domain/email';
import type { OAuthIdentity } from '../../domain/oauth';
import type { AccountRecord } from '../../domain/ports/account-identity.port';
import type { OperationContext } from '../../domain/ports/operation-context';
import { FakeSecretHasher } from '../fakes/fake-secret-hasher';
import { ManualClock } from '../fakes/manual-clock';
import { RecordingQueue } from '../fakes/recording-email';

const CTX = {} as OperationContext;
const BINDING = 'synthetic-binding';
const FLOW_TTL_MS = 60_000;
const ATTACKER_SESSION = 'synthetic-attacker-session';
const HOLDER: AccountRecord = {
  userId: 7,
  administratorId: 3,
  firstName: 'Sara',
  email: 'owner@example.test',
  locale: 'ar',
  emailVerifiedAt: new Date('2026-11-01T00:00:00Z'),
  providerLinkUnproven: false,
  businessId: 'business-a',
};
const IDENTITY: OAuthIdentity = {
  provider: 'google',
  subject: 'google-subject-1',
  email: HOLDER.email,
  emailVerified: true,
  firstName: 'Sara',
  lastName: 'Owner',
};

const plainSealer = {
  seal: (value: unknown) => JSON.stringify(value),
  open: (value: string) => JSON.parse(value) as unknown,
};

/** What the account already has when the provider sign-in arrives. */
interface Situation {
  readonly alreadyLinked: boolean;
  readonly holder?: AccountRecord;
}

/** The service under test and a log of what it did to the account, in order. */
interface Harness {
  readonly service: OAuthSignInService;
  readonly calls: string[];
  readonly voided: string[];
  readonly queue: RecordingQueue;
}

function harness({ alreadyLinked, holder = HOLDER }: Situation): Harness {
  const calls: string[] = [];
  const voided: string[] = [];
  const queue = new RecordingQueue();
  const hasher = new FakeSecretHasher();
  const clock = new ManualClock();
  const record = (name: string) => () => {
    calls.push(name);
    return Promise.resolve();
  };
  const flow = {
    provider: 'google',
    codeVerifier: 'synthetic-verifier',
    bindingHash: hasher.hash(BINDING),
    expiresAtMs: clock.now().getTime() + FLOW_TTL_MS,
  };
  const ports = {
    providers: { google: { authorizeUrl: () => '', exchange: () => Promise.resolve(IDENTITY) } },
    state: { write: () => 'state', read: () => flow },
    identity: {
      inTransaction: async <T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>) => {
        const result = await work(ctx);
        calls.push('commit');
        return result;
      },
      findByEmail: () => Promise.resolve(holder),
      findByUserId: () => Promise.resolve(holder),
      setProviderLinkUnproven: (_ctx: OperationContext, _id: number, unproven: boolean) => {
        calls.push(`setProviderLinkUnproven(${String(unproven)})`);
        return Promise.resolve();
      },
    },
    external: {
      findUserId: () => Promise.resolve(undefined),
      hasAny: () => Promise.resolve(alreadyLinked),
      link: record('link'),
      unlinkAll: record('unlinkAll'),
    },
    claims: { claim: () => Promise.resolve() },
    tokens: {
      issue: () => Promise.resolve({ token: 'synthetic-ticket' }),
      voidOpen: (_ctx: OperationContext, _userId: number, purposes: readonly string[]) => {
        voided.push(...purposes);
        return Promise.resolve();
      },
    },
    passwords: { voidPassword: record('voidPassword') },
    terminator: {
      endOthers: (_ctx: OperationContext, _userId: string, keepToken: string) => {
        calls.push(`endOthers(${keepToken})`);
        return Promise.resolve([ATTACKER_SESSION]);
      },
      flushCache: (tokens: readonly string[]) => {
        calls.push(`flushCache(${tokens.join(',')})`);
        return Promise.resolve();
      },
    },
    emails: new AuthEmailService(queue, plainSealer),
    hasher,
    clock,
    newPkce: () => ({ verifier: 'synthetic-verifier', challenge: 'synthetic-challenge' }),
    apiBaseUrl: 'https://api.example.test',
  } as unknown as OAuthSignInPorts;
  return { service: new OAuthSignInService(ports), calls, voided, queue };
}

const signIn = (service: OAuthSignInService) =>
  service.complete(CTX, 'google', { state: 'state', code: 'synthetic-code' }, BINDING);

const queuedRequests = (queue: RecordingQueue): AuthEmailRequest[] =>
  queue.queued.map((sealed) => JSON.parse(sealed) as AuthEmailRequest);

describe('the first provider link to an account with a password', () => {
  it('voids the password and ends every session in the transaction, and flushes them after the commit', async () => {
    // Arrange
    const { service, calls } = harness({ alreadyLinked: false });

    // Act
    const completion = await signIn(service);

    // Assert
    expect(completion.destination).toBe('sign-in');
    expect(calls).toContain('voidPassword');
    expect(calls).toContain('endOthers()');
    expect(calls.indexOf('flushCache(' + ATTACKER_SESSION + ')')).toBeGreaterThan(calls.indexOf('commit'));
  });

  it('voids the open reset and email change tokens', async () => {
    // Arrange
    const { service, voided } = harness({ alreadyLinked: false });

    // Act
    await signIn(service);

    // Assert
    expect(voided).toEqual(expect.arrayContaining(['password-reset', 'email-change']));
  });

  it('queues exactly one provider-linked notice to the account email, in its locale', async () => {
    // Arrange
    const { service, queue } = harness({ alreadyLinked: false });

    // Act
    await signIn(service);

    // Assert
    expect(queuedRequests(queue)).toEqual([
      {
        kind: 'provider-linked',
        to: HOLDER.email,
        locale: HOLDER.locale,
        vars: { name: HOLDER.firstName, provider: IDENTITY.provider },
      },
    ]);
  });
});

describe('a provider link to an account that already has a proven one', () => {
  it('leaves its password, sessions and mailbox alone', async () => {
    // Arrange
    const { service, calls, voided, queue } = harness({ alreadyLinked: true });

    // Act
    await signIn(service);

    // Assert
    expect(calls).toContain('link');
    expect(calls).not.toContain('voidPassword');
    expect(calls.some((call) => call.startsWith('endOthers'))).toBe(false);
    expect(voided).toEqual([]);
    expect(queue.queued).toEqual([]);
  });
});

describe('a provider link to an account whose only links were made on an unproven address', () => {
  it('removes those links and voids the password before linking', async () => {
    // Arrange
    const holder = { ...HOLDER, providerLinkUnproven: true };
    const { service, calls, queue } = harness({ alreadyLinked: true, holder });

    // Act
    await signIn(service);

    // Assert
    expect(calls.indexOf('unlinkAll')).toBeGreaterThanOrEqual(0);
    expect(calls.indexOf('unlinkAll')).toBeLessThan(calls.indexOf('link'));
    expect(calls).toContain('setProviderLinkUnproven(false)');
    expect(calls).toContain('voidPassword');
    expect(queue.queued).toHaveLength(1);
  });
});
