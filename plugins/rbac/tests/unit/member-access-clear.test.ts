import { type PermissionKey, RBAC_ERROR_CODES, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { MemberAccessService, type MemberAccessPorts } from '../../application/member-access.service';
import { MemberSuspensionRegistry } from '../../application/member-suspension-registry';
import type { BusinessRole, MemberAssignment } from '../../domain/business-role';
import { asOperationContext, type OperationContext } from '../../domain/ports/operation-context';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryAccessWorld } from '../fakes/in-memory-access-world';
import { SequentialIdGenerator } from '../fakes/sequential-id-generator';

// Team's deactivate and remove (P1.S4 Task 13, D204) clear a member's roles through `setAccess` with no role. These
// cases pin which store access such a clear may name: the member's own `selected` stores for a store-limited actor,
// `all` only for an all-store actor, never an empty `selected` list.

const OWNER = 1;
const S2_MANAGER = 2;
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
  assignment(S2_MANAGER, MANAGER_ROLE.id, [S2]),
  assignment(MEMBER, VIEWER_ROLE.id, [S2]),
];

/** The writes a clear makes, recorded. */
interface Writes {
  readonly replaceFor: MemberAccessPorts['assignments']['replaceFor'];
}

function servicePorts(writes: Writes): MemberAccessPorts {
  const world = new InMemoryAccessWorld({
    stores: [
      { id: S1, channelId: 1, status: 'active' },
      { id: S2, channelId: 2, status: 'active' },
    ],
    roles: [OWNER_ROLE, MANAGER_ROLE, VIEWER_ROLE],
    assignments: ASSIGNMENTS,
    ownerAdministratorId: OWNER,
  });
  const done = () => Promise.resolve();
  return {
    transaction: { run: <T>(c: OperationContext, _s: unknown, work: (t: OperationContext) => Promise<T>) => work(c) },
    lock: { acquire: done },
    members: {
      isMember: () => Promise.resolve(true),
      namesOf: () => Promise.resolve(new Map()),
      liveAdministratorIds: () => Promise.resolve([]),
    },
    directory: world.directory,
    roles: world.roles,
    assignments: {
      ofAdministrator: world.assignments.ofAdministrator,
      ofRoles: (_c, _s, ids) => Promise.resolve(ASSIGNMENTS.filter((row) => ids.includes(row.businessRoleId))),
      replaceFor: writes.replaceFor,
    },
    engine: { setAdministratorRoles: done },
    projector: { bindingsFor: () => Promise.resolve([]), releaseUnheld: done },
    activity: { record: done },
    flusher: { flushAdministrators: done },
    suspension: new MemberSuspensionRegistry(),
    ids: new SequentialIdGenerator(),
    clock: new FixedClock(NOW),
  };
}

const clearBy = (actor: number, storeAccess: 'all' | 'selected', storeIds: readonly string[]) => ({
  actor: { administratorId: actor, scope, ip: null, userAgent: null },
  administratorId: MEMBER,
  roleIds: [],
  storeAccess,
  storeIds,
});

describe('MemberAccessService.setAccess with no role (the clear Team deactivates with)', () => {
  it('clears a member for a store-limited actor naming the member own selected stores', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const view = await service.setAccess(ctx, clearBy(S2_MANAGER, 'selected', [S2]));

    // Assert
    expect(view.roles).toEqual([]);
    expect(writes.replaceFor).toHaveBeenCalledWith(ctx, scope, MEMBER, []);
  });

  it('refuses all stores from a store-limited actor, even with no role', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const clear = service.setAccess(ctx, clearBy(S2_MANAGER, 'all', []));

    // Assert
    await expect(clear).rejects.toMatchObject({ code: RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE });
    expect(writes.replaceFor).not.toHaveBeenCalled();
  });

  it('refuses a selected access naming no store, even with no role', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const clear = service.setAccess(ctx, clearBy(OWNER, 'selected', []));

    // Assert
    await expect(clear).rejects.toMatchObject({ code: RBAC_ERROR_CODES.STORE_ACCESS_INVALID });
    expect(writes.replaceFor).not.toHaveBeenCalled();
  });

  it('clears a member for an all-store actor naming all stores', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const view = await service.setAccess(ctx, clearBy(OWNER, 'all', []));

    // Assert
    expect(view.roles).toEqual([]);
    expect(writes.replaceFor).toHaveBeenCalledWith(ctx, scope, MEMBER, []);
  });
});

const withdrawBy = (
  actor: number,
  administratorId: number,
  storeAccess: 'all' | 'selected',
  storeIds: readonly string[],
) => ({
  actor: { administratorId: actor, scope, ip: null, userAgent: null },
  administratorId,
  storeAccess,
  storeIds,
});

describe('MemberAccessService.withdrawAccess (Team deactivate, D804)', () => {
  it('clears the member and returns the access it held, read in the same transaction under the lock', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const previous = await service.withdrawAccess(ctx, withdrawBy(OWNER, MEMBER, 'all', []));

    // Assert
    expect(previous).toEqual({
      administratorId: String(MEMBER),
      roles: [{ id: VIEWER_ROLE.id, name: VIEWER_ROLE.name }],
      storeAccess: 'selected',
      storeIds: [S2],
    });
    expect(writes.replaceFor).toHaveBeenCalledWith(ctx, scope, MEMBER, []);
  });

  it('returns no role for a member holding none, and writes nothing', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const previous = await service.withdrawAccess(ctx, withdrawBy(OWNER, 8, 'all', []));

    // Assert
    expect(previous.roles).toEqual([]);
    expect(writes.replaceFor).not.toHaveBeenCalled();
  });

  it('applies the same D60 rules as a clear: a store-limited actor may not name all stores', async () => {
    // Arrange
    const writes = { replaceFor: vi.fn(() => Promise.resolve()) };
    const service = new MemberAccessService(servicePorts(writes));

    // Act
    const withdrawal = service.withdrawAccess(ctx, withdrawBy(S2_MANAGER, MEMBER, 'all', []));

    // Assert
    await expect(withdrawal).rejects.toMatchObject({ code: RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE });
    expect(writes.replaceFor).not.toHaveBeenCalled();
  });
});
