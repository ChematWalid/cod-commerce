import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOG,
  UnknownPermissionError,
  areaLevelOf,
  expandRolePermissions,
  type PermissionKey,
} from '../../src/permissions/index.js';

const keysOf = (area: string, view = false): PermissionKey[] =>
  PERMISSION_CATALOG.filter((e) => e.area === area && (!view || e.level === 'view')).map((e) => e.key);

const expand = (input: Partial<Parameters<typeof expandRolePermissions>[0]>) =>
  expandRolePermissions({ base: [], areaLevels: [], grants: [], revokes: [], ...input });

describe('expandRolePermissions', () => {
  it('gives exactly the three view keys for Orders at View', () => {
    const result = expand({ areaLevels: [{ area: 'orders', level: 'view' }] });

    expect(result).toEqual(['orders.customers.view', 'orders.returns.view', 'orders.view']);
  });

  it('gives all 19 keys for Orders at Full', () => {
    expect(expand({ areaLevels: [{ area: 'orders', level: 'full' }] })).toHaveLength(19);
  });

  it('gives nothing for Orders at None', () => {
    expect(expand({ areaLevels: [{ area: 'orders', level: 'none' }] })).toEqual([]);
  });

  it('ends revoked when the same key is granted then revoked', () => {
    const result = expand({ grants: ['orders.cancel'], revokes: ['orders.cancel'] });

    expect(result).toEqual([]);
  });

  it('replaces the base only in the named areas', () => {
    const base = [...keysOf('orders'), ...keysOf('finance')];

    const result = expand({ base, areaLevels: [{ area: 'orders', level: 'none' }] });

    expect(result).toEqual([...keysOf('finance')].sort());
  });

  it('adds grants on top of an area level', () => {
    const result = expand({ areaLevels: [{ area: 'orders', level: 'view' }], grants: ['orders.view-all'] });

    expect(result).toContain('orders.view-all');
    expect(result).toHaveLength(4);
  });

  it('returns sorted, unique keys', () => {
    const result = expand({ base: ['orders.view', 'orders.create', 'orders.view'] });

    expect(result).toEqual(['orders.create', 'orders.view']);
  });

  it('throws on an unknown key in any input', () => {
    const unknown = 'orders.nope' as PermissionKey;

    expect(() => expand({ base: [unknown] })).toThrow(UnknownPermissionError);
    expect(() => expand({ grants: [unknown] })).toThrow(UnknownPermissionError);
    expect(() => expand({ revokes: [unknown] })).toThrow(UnknownPermissionError);
  });
});

describe('areaLevelOf', () => {
  it('reports none, view and full', () => {
    expect(areaLevelOf('orders', [])).toBe('none');
    expect(areaLevelOf('orders', keysOf('orders', true))).toBe('view');
    expect(areaLevelOf('orders', keysOf('orders'))).toBe('full');
  });

  it('ignores keys of other areas', () => {
    expect(areaLevelOf('orders', keysOf('finance'))).toBe('none');
  });

  it('reports custom for a partial set', () => {
    expect(areaLevelOf('orders', ['orders.create'])).toBe('custom');
    expect(areaLevelOf('orders', [...keysOf('orders', true), 'orders.view-all'])).toBe('custom');
  });

  it('round-trips with expandRolePermissions', () => {
    const view = expand({ areaLevels: [{ area: 'catalog', level: 'view' }] });

    expect(areaLevelOf('catalog', view)).toBe('view');
  });
});
