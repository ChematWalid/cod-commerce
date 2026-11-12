import { describe, expect, it, vi } from 'vitest';
import { InvitedAccountService, type InvitedAccountPorts } from '../../application/invited-account.service';
import { EmailTakenError } from '../../domain/errors';
import type { OperationContext } from '../../domain/ports/operation-context';
import { ManualClock } from '../fakes/manual-clock';

const CTX = { transactional: true } as unknown as OperationContext;
const ADMINISTRATOR_ID = 41;

function harness(options: { taken?: boolean } = {}) {
  const calls: string[] = [];
  const track = <T>(name: string, value: T) =>
    vi.fn((...args: unknown[]) => {
      expect(args[0]).toBe(CTX);
      calls.push(name);
      return Promise.resolve(value);
    });
  const mocks = {
    claim: track('claim', undefined),
    isEmailTaken: track('duplicate-check', options.taken ?? false),
    markEmailVerified: track('mark-verified', undefined),
    setEmailLocale: track('set-locale', undefined),
    setProviderLinkUnproven: track('provider-link', undefined),
  };
  const clock = new ManualClock();
  // The whole identity surface, so a call to a method the port leaves out would still be seen.
  const identity = {
    isEmailTaken: mocks.isEmailTaken,
    markEmailVerified: mocks.markEmailVerified,
    setEmailLocale: mocks.setEmailLocale,
    setProviderLinkUnproven: mocks.setProviderLinkUnproven,
  };
  const ports: InvitedAccountPorts = { claims: { claim: mocks.claim }, identity, clock };
  return { service: new InvitedAccountService(ports), mocks, calls, clock };
}

describe('InvitedAccountService.assertEmailFree', () => {
  it('claims the address before it checks whether an account holds it', async () => {
    // Arrange
    const { service, calls } = harness();

    // Act
    await service.assertEmailFree(CTX, 'sara@example.test');

    // Assert
    expect(calls).toEqual(['claim', 'duplicate-check']);
  });

  it('claims and compares the normalised address, as Vendure stores it lower-cased', async () => {
    // Arrange
    const { service, mocks } = harness();

    // Act
    await service.assertEmailFree(CTX, '  Sara@Example.TEST ');

    // Assert
    expect(mocks.claim).toHaveBeenCalledWith(CTX, 'sara@example.test');
    expect(mocks.isEmailTaken).toHaveBeenCalledWith(CTX, 'sara@example.test');
  });

  it('refuses an address a live administrator already holds', async () => {
    // Arrange
    const { service } = harness({ taken: true });

    // Act
    const attempt = service.assertEmailFree(CTX, 'Taken@Example.test');

    // Assert
    await expect(attempt).rejects.toBeInstanceOf(EmailTakenError);
  });
});

describe('InvitedAccountService.markInvitedVerified', () => {
  it('marks the address verified now and sets the email language', async () => {
    // Arrange
    const { service, mocks, clock } = harness();

    // Act
    await service.markInvitedVerified(CTX, ADMINISTRATOR_ID, 'en');

    // Assert
    expect(mocks.markEmailVerified).toHaveBeenCalledWith(CTX, ADMINISTRATOR_ID, clock.now());
    expect(mocks.setEmailLocale).toHaveBeenCalledWith(CTX, ADMINISTRATOR_ID, 'en');
  });

  it('leaves the unproven provider link flag alone', async () => {
    // Arrange
    const { service, mocks } = harness();

    // Act
    await service.markInvitedVerified(CTX, ADMINISTRATOR_ID, 'ar');

    // Assert
    expect(mocks.setProviderLinkUnproven).not.toHaveBeenCalled();
  });

  it('neither claims nor checks the address', async () => {
    // Arrange
    const { service, calls } = harness();

    // Act
    await service.markInvitedVerified(CTX, ADMINISTRATOR_ID, 'ar');

    // Assert
    expect(calls).toEqual(['mark-verified', 'set-locale']);
  });
});
