import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_ACTIONS,
  BUILT_IN_ROLES,
  BUILT_IN_ROLE_KEYS,
  PERMISSION_CATALOG,
  RBAC_ERROR_CODES,
  isPermissionKey,
} from '../../src/permissions/index.js';

const role = (key: string) => {
  const found = BUILT_IN_ROLES.find((r) => r.key === key);
  if (!found) throw new Error(`missing built-in role ${key}`);
  return found;
};
const MANAGER_EXCLUDES = [
  'orders.delete',
  'orders.comments.delete',
  'catalog.products.delete',
  'catalog.collections.delete',
  'offers.delete',
  'finance.records.delete',
  'finance.expenses.delete',
  'team.members.remove',
  'team.roles.delete',
  'team.commissions.delete',
  'delivery.carriers.delete',
  'delivery.pricing.delete',
  'store.landing-pages.delete',
  'store.domains.remove',
  'store.stores.archive',
  'apps.disconnect',
  'settings.business.edit',
];

describe('built-in roles', () => {
  it('lists the seven keys in order', () => {
    expect([...BUILT_IN_ROLE_KEYS]).toEqual([
      'owner',
      'manager',
      'order-manager',
      'inventory-manager',
      'accountant',
      'order-tracker',
      'store-manager',
    ]);
    expect(BUILT_IN_ROLES.map((r) => r.key)).toEqual([...BUILT_IN_ROLE_KEYS]);
  });

  it('has the documented sizes', () => {
    const sizes = BUILT_IN_ROLES.map((r) => r.permissions.length);

    expect(sizes).toEqual([94, 77, 19, 12, 11, 3, 23]);
  });

  it('holds only unique catalog keys, sorted', () => {
    for (const r of BUILT_IN_ROLES) {
      expect(new Set(r.permissions).size).toBe(r.permissions.length);
      expect(r.permissions.every(isPermissionKey)).toBe(true);
      expect([...r.permissions]).toEqual([...r.permissions].sort());
    }
  });

  it('gives the manager everything except the 17 excluded keys', () => {
    const missing = PERMISSION_CATALOG.map((e) => e.key).filter((k) => !role('manager').permissions.includes(k));

    expect([...missing].sort()).toEqual([...MANAGER_EXCLUDES].sort());
  });

  it('lets only the owner archive stores', () => {
    const holders = BUILT_IN_ROLES.filter((r) => r.permissions.includes('store.stores.archive')).map((r) => r.key);

    expect(holders).toEqual(['owner']);
  });

  it('gives the store manager every Store and Products key except archiving stores', () => {
    const inAreas = PERMISSION_CATALOG.filter((e) => e.area === 'store' || e.area === 'catalog').map((e) => e.key);
    const missing = inAreas.filter((k) => !role('store-manager').permissions.includes(k));

    expect(missing).toEqual(['store.stores.archive']);
    expect(role('store-manager').permissions).toHaveLength(inAreas.length - missing.length);
  });

  it('gives the accountant finance, order views and view-all', () => {
    const p = role('accountant').permissions;

    expect(p).toEqual(expect.arrayContaining(['orders.view-all', 'orders.view', 'finance.records.add']));
    expect(p).not.toContain('orders.create');
  });

  it('writes distinct English and Arabic labels and descriptions', () => {
    for (const r of BUILT_IN_ROLES) {
      for (const text of [r.label, r.description]) {
        expect(text.en.trim()).not.toBe('');
        expect(text.ar).toMatch(/[؀-ۿ]/);
      }
    }
    expect(new Set(BUILT_IN_ROLES.map((r) => r.label.en.toLowerCase())).size).toBe(7);
  });
});

describe('error codes and activity actions', () => {
  it('exposes the 16 rbac error codes', () => {
    expect(Object.values(RBAC_ERROR_CODES)).toHaveLength(16);
    expect(RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED).toBe('rbac.privilege-exceeded');
    expect(Object.values(RBAC_ERROR_CODES).every((c) => c.startsWith('rbac.'))).toBe(true);
  });

  it('exposes the five roles activity actions', () => {
    expect(Object.values(ACTIVITY_ACTIONS).filter((action) => action.startsWith('rbac.'))).toEqual([
      'rbac.role.created',
      'rbac.role.updated',
      'rbac.role.deleted',
      'rbac.role.duplicated',
      'rbac.member-access.changed',
    ]);
  });
});
