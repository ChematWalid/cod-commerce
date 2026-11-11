import { type PermissionKey, RBAC_ERROR_CODES as RBAC_CODES, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { BusinessRole, MemberAssignment } from '../../domain/business-role';
import { assertCanChangeTarget } from '../../domain/escalation-rules';
import {
  accessChange,
  activeStoreIdsOf,
  type BusinessStore,
  buildActor,
  reachOf,
  reachStoreIdsOf,
  resolveStoreAccess,
} from '../../domain/store-access';

const A1 = toStoreId('11');
const A2 = toStoreId('12');
const GONE = toStoreId('13');
const stores: readonly BusinessStore[] = [
  { id: A1, channelId: 1, status: 'active' },
  { id: A2, channelId: 2, status: 'active' },
  { id: GONE, channelId: 3, status: 'archived' },
];
const NOW = new Date('2026-01-01T00:00:00.000Z');

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

const assignment = (roleId: string, storeIds: readonly string[] | 'all'): MemberAssignment => ({
  id: toSnowflake('900'),
  administratorId: 7,
  businessRoleId: toSnowflake(roleId),
  storeAccess: storeIds === 'all' ? 'all' : 'selected',
  storeIds: storeIds === 'all' ? [] : storeIds.map(toSnowflake),
  createdAt: NOW,
});

describe('resolveStoreAccess', () => {
  it.each([
    ['selected with no store', 'selected', [], RBAC_CODES.STORE_ACCESS_INVALID],
    ['a store of another business', 'selected', ['99'], RBAC_CODES.STORE_NOT_ACCESSIBLE],
    ['an archived store alone', 'selected', ['13'], RBAC_CODES.STORE_NOT_ACCESSIBLE],
    ['an archived store beside an active one', 'selected', ['11', '13'], RBAC_CODES.STORE_NOT_ACCESSIBLE],
    ['text that is no id', 'selected', ['abc'], RBAC_CODES.STORE_NOT_ACCESSIBLE],
  ] as const)('refuses %s', (_name, storeAccess, storeIds, code) => {
    // Act
    const act = () => resolveStoreAccess({ storeAccess, storeIds }, stores);

    // Assert
    expect(act).toThrow(expect.objectContaining({ code }) as Error);
  });

  it('keeps selected stores once each', () => {
    // Act
    const resolved = resolveStoreAccess({ storeAccess: 'selected', storeIds: ['11', '12', '11'] }, stores);

    // Assert
    expect(resolved).toEqual({ storeAccess: 'selected', storeIds: [A1, A2] });
  });

  it('ignores a store list sent with all stores', () => {
    // Act
    const resolved = resolveStoreAccess({ storeAccess: 'all', storeIds: ['99'] }, stores);

    // Assert
    expect(resolved).toEqual({ storeAccess: 'all', storeIds: [] });
  });
});

describe('buildActor', () => {
  const activeIds = activeStoreIdsOf(stores);
  const roles = new Map([
    ['1', role('1', ['orders.view'])],
    ['2', role('2', ['orders.cancel'])],
    ['3', role('3', ['orders.view', 'orders.cancel'], true)],
  ]);

  it('unions permissions per store, across roles', () => {
    // Act
    const actor = buildActor(7, [assignment('1', ['11']), assignment('2', ['11', '12'])], roles, activeIds);

    // Assert
    expect(actor.permissionsByStore.get(A1)).toEqual(new Set(['orders.view', 'orders.cancel']));
    expect(actor.permissionsByStore.get(A2)).toEqual(new Set(['orders.cancel']));
    expect(actor.hasAllAccess).toBe(false);
  });

  it('gives an all-stores role every active store, and no archived one', () => {
    // Act
    const actor = buildActor(7, [assignment('3', 'all')], roles, activeIds);

    // Assert
    expect([...actor.permissionsByStore.keys()]).toEqual([A1, A2]);
    expect(actor.hasAllAccess).toBe(true);
    expect(actor.isOwnerHolder).toBe(true);
  });

  it('grants nothing through an archived store in a selected list', () => {
    // Act
    const actor = buildActor(7, [assignment('1', ['13'])], roles, activeIds);

    // Assert
    expect(actor.permissionsByStore.size).toBe(0);
  });

  it('does not count a member with no rows as all-access', () => {
    // Act
    const actor = buildActor(7, [], roles, activeIds);

    // Assert
    expect(actor.hasAllAccess).toBe(false);
    expect(actor.isOwnerHolder).toBe(false);
  });

  it('treats a mix of all and selected rows as not all-access, failing closed', () => {
    // Act
    const actor = buildActor(7, [assignment('1', 'all'), assignment('2', ['11'])], roles, activeIds);

    // Assert
    expect(actor.hasAllAccess).toBe(false);
  });
});

describe('accessChange', () => {
  const activeIds = activeStoreIdsOf(stores);

  it('reports nothing for the same access', () => {
    // Act
    const change = accessChange([assignment('1', ['11'])], [assignment('1', ['11'])], activeIds);

    // Assert
    expect(change).toEqual([]);
  });

  it('reports a store added to a kept role', () => {
    // Act
    const change = accessChange([assignment('1', ['11'])], [assignment('1', ['11', '12'])], activeIds);

    // Assert
    expect(change).toEqual([{ businessRoleId: toSnowflake('1'), storeId: A2 }]);
  });

  it('reports both the role removed and the role added', () => {
    // Act
    const change = accessChange([assignment('1', ['11'])], [assignment('2', ['11'])], activeIds);

    // Assert
    expect(change).toEqual([
      { businessRoleId: toSnowflake('2'), storeId: A1 },
      { businessRoleId: toSnowflake('1'), storeId: A1 },
    ]);
  });

  it('expands all stores to the active ones', () => {
    // Act
    const change = accessChange([], [assignment('1', 'all')], activeIds);

    // Assert
    expect(change.map((pair) => pair.storeId)).toEqual([A1, A2]);
  });
});

describe('reach for the D60 checks, over every store of the business (D210)', () => {
  const everyId = reachStoreIdsOf(stores);
  const roles = new Map([['1', role('1', ['orders.view'])]]);

  it('counts archived stores beside active ones', () => {
    // Act
    const ids = reachStoreIdsOf(stores);

    // Assert
    expect(ids).toEqual([A1, A2, GONE]);
  });

  it('gives a role held only on an archived store a reach there', () => {
    // Act
    const target = buildActor(8, [assignment('1', ['13'])], roles, everyId);

    // Assert
    expect(target.permissionsByStore.get(GONE)).toEqual(new Set(['orders.view']));
  });

  it('refuses an actor without that archived store a change of such a member', () => {
    // Arrange
    const actor = buildActor(7, [assignment('1', ['11'])], roles, everyId);
    const target = buildActor(8, [assignment('1', ['13'])], roles, everyId);

    // Act
    const act = () => {
      assertCanChangeTarget(actor, target);
    };

    // Assert
    expect(act).toThrow(expect.objectContaining({ code: RBAC_CODES.PRIVILEGE_EXCEEDED }) as Error);
  });

  it('reports the archived store a role leaves', () => {
    // Act
    const change = accessChange([assignment('1', ['13'])], [assignment('1', ['11'])], everyId);

    // Assert
    expect(change).toEqual([
      { businessRoleId: toSnowflake('1'), storeId: A1 },
      { businessRoleId: toSnowflake('1'), storeId: GONE },
    ]);
  });

  it('gives a role bound only to an archived store that store as its reach', () => {
    // Act
    const reach = reachOf([GONE], everyId);

    // Assert
    expect(reach).toEqual([GONE]);
  });
});
