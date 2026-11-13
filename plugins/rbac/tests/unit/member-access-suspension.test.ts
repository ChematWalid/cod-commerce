import { type PermissionKey, RBAC_ERROR_CODES, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { MemberAccessService, type MemberAccessPorts } from '../../application/member-access.service';
import { MemberSuspensionRegistry } from '../../application/member-suspension-registry';
import type { BusinessRole, MemberAssignment } from '../../domain/business-role';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryAccessWorld } from '../fakes/in-memory-access-world';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

const OWNER = 1;
const S1_MANAGER = 2;
const MEMBER = 7;
const S1 = toStoreId('11');
const S2 = toStoreId('12');
const NOW = new Date('2026-01-01T00:00:00.000Z');
const ctx = asOperationContext({});
const scope = { businessId: toBusinessId('500') };

const role = (id: string, permissions: readonly PermissionKey[], owner = false): BusinessRole => ({
  id: toSnowflake(id),
  name: id,
  nameKey: id,
  description: null,
  builtInKey: owner ? 'owner' : null,
  permissions,
  createdAt: NOW,
  updatedAt: NOW,
});

const OWNER_ROLE = role('101', ['orders.view', 'orders.edit'], true);
const MANAGER_ROLE = role('102', ['orders.view', 'orders.edit']);
const VIEWER_ROLE = role('103', ['orders.view']);

const assignment = (
  administratorId: number,
  roleId: string,
  storeIds: readonly string[] | 'all',
): MemberAssignment => ({
  id: toSnowflake(String(900 + administratorId)),
  administratorId,
  businessRoleId: toSnowflake(roleId),
  storeAccess: storeIds === 'all' ? 'all' : 'selected',
  storeIds: storeIds === 'all' ? [] : storeIds.map(toSnowflake),
  createdAt: NOW,
});

const ASSIGNMENTS = [
  assignment(OWNER, OWNER_ROLE.id, 'all'),
  assignment(S1_MANAGER, MANAGER_ROLE.id, [S1]),
  assignment(MEMBER, VIEWER_ROLE.id, [S2]),
];

/** A port call that must not happen: a refusal writes nothing. */
const untouched = (name: string) => (): Promise<never> => Promise.reject(new Error(`${name} must not be called`));

function servicePorts(suspension: MemberSuspensionRegistry, flush = vi.fn(() => Promise.resolve())): MemberAccessPorts {
  const world = new InMemoryAccessWorld({
    stores: [
      { id: S1, channelId: 1, status: 'active' },
      { id: S2, channelId: 2, status: 'active' },
    ],
    roles: [OWNER_ROLE, MANAGER_ROLE, VIEWER_ROLE],
    assignments: ASSIGNMENTS,
    ownerAdministratorId: OWNER,
  });
  return {
    transaction: { run: <T>(c: OperationContext, _s: unknown, work: (t: OperationContext) => Promise<T>) => work(c) },
    lock: { acquire: () => Promise.resolve() },
    members: {
      isMember: () => Promise.resolve(true),
      namesOf: untouched('namesOf'),
      liveAdministratorIds: untouched('liveAdministratorIds'),
    },
    directory: world.directory,
    roles: world.roles,
    assignments: {
      ofAdministrator: world.assignments.ofAdministrator,
      ofRoles: (_c, _s, ids) => Promise.resolve(ASSIGNMENTS.filter((row) => ids.includes(row.businessRoleId))),
      replaceFor: untouched('replaceFor'),
    },
    engine: { setAdministratorRoles: untouched('setAdministratorRoles') },
    projector: { bindingsFor: untouched('bindingsFor'), releaseUnheld: untouched('releaseUnheld') },
    activity: { record: untouched('record') },
    flusher: { flushAdministrators: flush },
    suspension,
    ids: new SequentialIdGenerator(),
    clock: new FixedClock(NOW),
  };
}

const suspendedMember = (): MemberSuspensionRegistry => {
  const registry = new MemberSuspensionRegistry();
  registry.register({ isSuspended: (_c, _s, administratorId) => Promise.resolve(administratorId === MEMBER) });
  return registry;
};

const grantBy = (actor: number) => ({
  actor: { administratorId: actor, scope, ip: null, userAgent: null },
  administratorId: MEMBER,
  roleIds: [VIEWER_ROLE.id],
  storeAccess: 'selected' as const,
  storeIds: [S1],
});

describe('MemberAccessService and suspended members', () => {
  it('refuses an actor allowed to make the change, and writes nothing', async () => {
    // Arrange
    const flush = vi.fn(() => Promise.resolve());
    const service = new MemberAccessService(servicePorts(suspendedMember(), flush));

    // Act
    const change = service.setAccess(ctx, grantBy(OWNER));

    // Assert
    await expect(change).rejects.toMatchObject({ code: RBAC_ERROR_CODES.MEMBER_SUSPENDED });
    expect(flush).not.toHaveBeenCalled();
  });

  it('answers an actor who may not reach the member with the reach refusal, not the suspension (D211)', async () => {
    // Arrange
    const service = new MemberAccessService(servicePorts(suspendedMember()));

    // Act
    const change = service.setAccess(ctx, grantBy(S1_MANAGER));

    // Assert
    await expect(change).rejects.toMatchObject({ code: RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED });
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
