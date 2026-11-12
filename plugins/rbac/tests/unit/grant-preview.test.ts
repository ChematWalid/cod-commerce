import { type PermissionKey, RBAC_ERROR_CODES as RBAC_CODES, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { GrantPreviewService, type PreviewGrantCommand } from '../../application/grant-preview.service';
import type { BusinessRole, MemberAssignment } from '../../domain/business-role';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { BusinessStore } from '../../domain/store-access';
import { InMemoryAccessWorld } from '../fakes/in-memory-access-world';

const S1 = toStoreId('11');
const S2 = toStoreId('12');
const ARCHIVED = toStoreId('13');
const OWNER = 1;
const S1_MANAGER = 2;
const STRANGER = 3;
const NOW = new Date('2026-01-01T00:00:00.000Z');
const ctx = asOperationContext({});
const scope = { businessId: toBusinessId('500') };

const stores: readonly BusinessStore[] = [
  { id: S1, channelId: 1, status: 'active' },
  { id: S2, channelId: 2, status: 'active' },
  { id: ARCHIVED, channelId: 3, status: 'archived' },
];

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

const ROLES = {
  owner: role('101', ['orders.view', 'orders.edit', 'orders.delete'], true),
  manager: role('102', ['orders.view', 'orders.edit']),
  viewer: role('103', ['orders.view']),
  deleter: role('104', ['orders.delete']),
};

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

const world = new InMemoryAccessWorld({
  stores,
  roles: Object.values(ROLES),
  assignments: [assignment(OWNER, ROLES.owner.id, 'all'), assignment(S1_MANAGER, ROLES.manager.id, [S1])],
  ownerAdministratorId: OWNER,
});
const service = new GrantPreviewService(world);

const grant = (
  actorId: number,
  roleIds: readonly string[],
  storeAccess: 'all' | 'selected',
  storeIds: readonly string[] = [],
): PreviewGrantCommand => ({
  actor: { administratorId: actorId, scope, ip: null, userAgent: null },
  roleIds,
  storeAccess,
  storeIds,
});

describe('GrantPreviewService.previewGrant', () => {
  it.each([
    ['a role of another business', grant(OWNER, ['999'], 'all'), RBAC_CODES.ROLE_NOT_FOUND],
    [
      'a store the actor lacks',
      grant(S1_MANAGER, [ROLES.viewer.id], 'selected', [S2]),
      RBAC_CODES.STORE_NOT_ACCESSIBLE,
    ],
    [
      'all stores from a store-limited actor',
      grant(S1_MANAGER, [ROLES.viewer.id], 'all'),
      RBAC_CODES.STORE_NOT_ACCESSIBLE,
    ],
    [
      'a permission the actor lacks',
      grant(S1_MANAGER, [ROLES.deleter.id], 'selected', [S1]),
      RBAC_CODES.PRIVILEGE_EXCEEDED,
    ],
    [
      'the Owner role from a non-holder',
      grant(S1_MANAGER, [ROLES.owner.id], 'selected', [S1]),
      RBAC_CODES.OWNER_RESTRICTED,
    ],
    ['an archived store', grant(OWNER, [ROLES.viewer.id], 'selected', [ARCHIVED]), RBAC_CODES.STORE_NOT_ACCESSIBLE],
    ['selected access with no store', grant(OWNER, [ROLES.viewer.id], 'selected'), RBAC_CODES.STORE_ACCESS_INVALID],
  ] as const)('refuses %s', async (_name, command, code) => {
    // Act
    const preview = service.previewGrant(ctx, command);

    // Assert
    await expect(preview).rejects.toMatchObject({ code });
  });

  it.each([
    ['a role within reach on the actor’s store', grant(S1_MANAGER, [ROLES.viewer.id], 'selected', [S1])],
    ['every role on all stores from an all-stores owner', grant(OWNER, [ROLES.owner.id, ROLES.manager.id], 'all')],
  ] as const)('accepts %s', async (_name, command) => {
    // Act
    const preview = service.previewGrant(ctx, command);

    // Assert
    await expect(preview).resolves.toBeUndefined();
  });
});

describe('GrantPreviewService.reachOf', () => {
  it('gives an all-stores actor every store of the business', async () => {
    // Act
    const reach = await service.reachOf(ctx, { administratorId: OWNER, scope });

    // Assert
    expect(reach).toEqual({ allStores: true, storeIds: [S1, S2, ARCHIVED] });
  });

  it('gives a store-limited actor the stores its roles name', async () => {
    // Act
    const reach = await service.reachOf(ctx, { administratorId: S1_MANAGER, scope });

    // Assert
    expect(reach).toEqual({ allStores: false, storeIds: [S1] });
  });

  it('gives someone holding no role no store', async () => {
    // Act
    const reach = await service.reachOf(ctx, { administratorId: STRANGER, scope });

    // Assert
    expect(reach).toEqual({ allStores: false, storeIds: [] });
  });
});
