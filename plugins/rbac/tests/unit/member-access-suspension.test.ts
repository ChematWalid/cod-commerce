import { RBAC_ERROR_CODES, toBusinessId } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { MemberAccessService, type MemberAccessPorts } from '../../application/member-access.service';
import { MemberSuspensionRegistry } from '../../application/member-suspension-registry';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { FixedClock } from '../fakes/fixed-clock';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

const ACTOR = 1;
const MEMBER = 7;
const ROLE = '102';
const ctx = asOperationContext({});
const scope = { businessId: toBusinessId('500') };

/** A port call that must not happen: the refusal comes before any read of the world or any write. */
const untouched = (name: string) => (): Promise<never> => Promise.reject(new Error(`${name} must not be called`));

function servicePorts(suspension: MemberSuspensionRegistry, flush = vi.fn(() => Promise.resolve())): MemberAccessPorts {
  return {
    transaction: { run: <T>(c: OperationContext, _s: unknown, work: (t: OperationContext) => Promise<T>) => work(c) },
    lock: { acquire: () => Promise.resolve() },
    members: {
      isMember: () => Promise.resolve(true),
      namesOf: untouched('namesOf'),
      liveAdministratorIds: untouched('liveAdministratorIds'),
    },
    directory: { stores: untouched('stores'), ownerAdministratorOf: untouched('ownerAdministratorOf') },
    roles: { all: untouched('roles.all') },
    assignments: {
      ofAdministrator: untouched('ofAdministrator'),
      ofRoles: untouched('ofRoles'),
      replaceFor: untouched('replaceFor'),
    },
    engine: { setAdministratorRoles: untouched('setAdministratorRoles') },
    projector: { bindingsFor: untouched('bindingsFor'), releaseUnheld: untouched('releaseUnheld') },
    activity: { record: untouched('record') },
    flusher: { flushAdministrators: flush },
    suspension,
    ids: new SequentialIdGenerator(),
    clock: new FixedClock(new Date('2026-01-01T00:00:00.000Z')),
  };
}

const suspendedMember = (): MemberSuspensionRegistry => {
  const registry = new MemberSuspensionRegistry();
  registry.register({ isSuspended: (_c, _s, administratorId) => Promise.resolve(administratorId === MEMBER) });
  return registry;
};

const grantRole = { actor: { administratorId: ACTOR, scope, ip: null, userAgent: null }, administratorId: MEMBER };

describe('MemberAccessService and suspended members', () => {
  it('refuses to grant roles to a suspended member before reading or writing anything', async () => {
    // Arrange
    const flush = vi.fn(() => Promise.resolve());
    const service = new MemberAccessService(servicePorts(suspendedMember(), flush));

    // Act
    const change = service.setAccess(ctx, { ...grantRole, roleIds: [ROLE], storeAccess: 'all', storeIds: [] });

    // Assert
    await expect(change).rejects.toMatchObject({ code: RBAC_ERROR_CODES.MEMBER_SUSPENDED });
    expect(flush).not.toHaveBeenCalled();
  });

  it('asks no check about a member when nothing is registered', async () => {
    // Arrange
    const registry = new MemberSuspensionRegistry();

    // Act
    const suspended = await registry.isSuspended(ctx, scope, MEMBER);

    // Assert
    expect(suspended).toBe(false);
  });
});

describe('MemberAccessService.flushSessionsOf', () => {
  it('evicts the sessions of the named administrators once', async () => {
    // Arrange
    const flush = vi.fn(() => Promise.resolve());
    const service = new MemberAccessService(servicePorts(new MemberSuspensionRegistry(), flush));

    // Act
    await service.flushSessionsOf([MEMBER]);

    // Assert
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith([MEMBER]);
  });
});
