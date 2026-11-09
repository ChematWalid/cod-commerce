import { areaLevelOf, type PermissionKey } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  emptyDraft,
  previewOf,
  roleInputOf,
  withAreaLevel,
  withPermission,
  withStartFrom,
} from '../../dashboard/role-draft';

const VIEW_ORDERS: PermissionKey = 'orders.view';
const CANCEL_ORDERS: PermissionKey = 'orders.cancel';
const VIEW_TRACKING: PermissionKey = 'tracking.view';

describe('role draft', () => {
  it('sends only what the user touched, and never a permission list', () => {
    const draft = withPermission(withAreaLevel(emptyDraft([]), 'orders', 'view'), CANCEL_ORDERS, true);

    const input = roleInputOf(draft);

    expect(input).toEqual({
      areaLevels: [{ area: 'orders', level: 'view' }],
      grants: [CANCEL_ORDERS],
      revokes: [],
    });
    expect(input).not.toHaveProperty('permissions');
  });

  it('a toggle put back to where it started sends nothing', () => {
    const toggled = withPermission(emptyDraft([]), VIEW_TRACKING, true);

    const input = roleInputOf(withPermission(toggled, VIEW_TRACKING, false));

    expect(input.grants).toEqual([]);
    expect(input.revokes).toEqual([]);
  });

  it('revokes a key the base holds', () => {
    const input = roleInputOf(withPermission(emptyDraft([VIEW_ORDERS, CANCEL_ORDERS]), CANCEL_ORDERS, false));

    expect(input.revokes).toEqual([CANCEL_ORDERS]);
  });

  it('turns an area custom when a toggle departs from its level', () => {
    const draft = withPermission(withAreaLevel(emptyDraft([]), 'orders', 'view'), CANCEL_ORDERS, true);

    expect(areaLevelOf('orders', previewOf(draft))).toBe('custom');
  });

  it('choosing a level drops the toggles of that area only', () => {
    const toggled = withPermission(withPermission(emptyDraft([]), CANCEL_ORDERS, true), VIEW_TRACKING, true);

    const input = roleInputOf(withAreaLevel(toggled, 'orders', 'none'));

    expect(input.grants).toEqual([VIEW_TRACKING]);
  });

  it('starting from a role replaces the base and clears earlier choices', () => {
    const touched = withAreaLevel(emptyDraft([]), 'orders', 'full');

    const draft = withStartFrom(touched, { id: 'role-1', permissions: [VIEW_TRACKING] });

    expect(previewOf(draft)).toEqual([VIEW_TRACKING]);
    expect(roleInputOf(draft)).toEqual({ startFromRoleId: 'role-1', areaLevels: [], grants: [], revokes: [] });
  });

  it('clearing the start role goes back to the original base', () => {
    const started = withStartFrom(emptyDraft([VIEW_ORDERS]), { id: 'role-1', permissions: [VIEW_TRACKING] });

    const draft = withStartFrom(started, null);

    expect(previewOf(draft)).toEqual([VIEW_ORDERS]);
    expect(roleInputOf(draft)).not.toHaveProperty('startFromRoleId');
  });
});
