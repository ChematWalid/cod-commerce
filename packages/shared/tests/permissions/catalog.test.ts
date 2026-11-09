import { describe, expect, it } from 'vitest';
import {
  PERMISSION_AREAS,
  PERMISSION_CATALOG,
  isPermissionKey,
  vendurePermissionName,
} from '../../src/permissions/index.js';

const AREA_COUNTS: Record<string, number> = {
  orders: 19,
  tracking: 3,
  catalog: 8,
  offers: 4,
  inventory: 4,
  finance: 7,
  analytics: 2,
  team: 12,
  delivery: 8,
  store: 15,
  apps: 8,
  settings: 3,
};

const SENSITIVE_KEYS = [
  'orders.view-all',
  'orders.delete',
  'orders.cancel',
  'orders.returns.create',
  'orders.comments.delete',
  'orders.discount',
  'tracking.view-all',
  'catalog.products.delete',
  'catalog.collections.delete',
  'offers.delete',
  'inventory.buy-prices',
  'finance.records.delete',
  'finance.expenses.delete',
  'team.members.remove',
  'team.roles.delete',
  'team.commissions.delete',
  'delivery.carriers.delete',
  'delivery.pricing.delete',
  'store.publish',
  'store.discard',
  'store.landing-pages.delete',
  'store.domains.remove',
  'apps.disconnect',
  'settings.business.edit',
];

const ARABIC_SCRIPT = /[؀-ۿ]/;
const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

describe('permission catalog', () => {
  it('holds exactly 93 unique keys', () => {
    const keys = PERMISSION_CATALOG.map((entry) => entry.key);

    expect(keys).toHaveLength(93);
    expect(new Set(keys).size).toBe(93);
  });

  it('has the documented count per area and 12 ordered areas', () => {
    const counts: Record<string, number> = {};
    for (const entry of PERMISSION_CATALOG) counts[entry.area] = (counts[entry.area] ?? 0) + 1;

    expect(counts).toEqual(AREA_COUNTS);
    expect(PERMISSION_AREAS).toHaveLength(12);
    expect(PERMISSION_AREAS.map((area) => area.order)).toEqual([...Array(12).keys()].map((i) => i + 1));
  });

  it('prefixes every key with its area', () => {
    for (const entry of PERMISSION_CATALOG) expect(entry.key.startsWith(`${entry.area}.`)).toBe(true);
  });

  it('marks exactly the 24 documented keys as sensitive', () => {
    const sensitive = PERMISSION_CATALOG.filter((entry) => entry.sensitive).map((entry) => entry.key);

    expect([...sensitive].sort()).toEqual([...SENSITIVE_KEYS].sort());
  });

  it('has 25 view-level keys and none is sensitive', () => {
    const views = PERMISSION_CATALOG.filter((entry) => entry.level === 'view');

    expect(views).toHaveLength(25);
    expect(views.some((entry) => entry.sensitive)).toBe(false);
  });

  it('writes distinct English and Arabic labels for every key and area', () => {
    for (const entry of [...PERMISSION_CATALOG, ...PERMISSION_AREAS]) {
      expect(entry.label.en.trim()).not.toBe('');
      expect(entry.label.ar).toMatch(ARABIC_SCRIPT);
      expect(entry.label.ar).not.toBe(entry.label.en);
    }
  });

  it('gives each key a distinct English label inside its area', () => {
    const seen = new Set(PERMISSION_CATALOG.map((entry) => `${entry.area}|${entry.label.en}`));

    expect(seen.size).toBe(93);
  });
});

describe('vendurePermissionName', () => {
  it('maps dotted keys to legal, distinct GraphQL enum names', () => {
    const names = PERMISSION_CATALOG.map((entry) => vendurePermissionName(entry.key));

    for (const name of names) expect(name).toMatch(GRAPHQL_NAME);
    expect(new Set(names).size).toBe(93);
  });

  it('uses Cod plus PascalCase of the segments', () => {
    expect(vendurePermissionName('orders.cancel')).toBe('CodOrdersCancel');
    expect(vendurePermissionName('orders.view-all')).toBe('CodOrdersViewAll');
  });
});

describe('isPermissionKey', () => {
  it('accepts catalog keys only', () => {
    expect(isPermissionKey('orders.cancel')).toBe(true);
    expect(isPermissionKey('orders.nope')).toBe(false);
    expect(isPermissionKey(42)).toBe(false);
  });
});
