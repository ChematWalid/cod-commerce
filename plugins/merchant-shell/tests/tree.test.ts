import { describe, expect, it } from 'vitest';
import { storePathFor } from '../dashboard/model/store-path';
import { SHELL_LEAVES, SHELL_TREE } from '../dashboard/model/tree';

/** Stock Vendure file routes that an extension route must never shadow (D81). */
const STOCK_ROUTES = [
  '/orders',
  '/products',
  '/collections',
  '/customers',
  '/stock-locations',
  '/channels',
  '/profile',
  '/',
  '/settings-store',
];

/** The tree of the plan's Task 3 table: id, URL, permissions, owner. `*` leaves are store-scoped. */
const EXPECTED: ReadonlyArray<readonly [string, string, readonly string[], string]> = [
  ['home', '/home', [], 'P7.S2'],
  ['orders.all', '/cod-orders', ['orders.view'], 'P4.S2'],
  ['orders.customers', '/cod-orders/customers', ['orders.customers.view'], 'P4.S7'],
  ['orders.spam', '/cod-orders/spam', ['orders.view'], 'P4.S5'],
  ['tracking.shipments', '/tracking', ['tracking.view'], 'P5.S2'],
  ['tracking.returns', '/tracking/returns', ['orders.returns.view'], 'P5.S3'],
  ['products.all', '/stores/active/products', ['catalog.products.view'], 'P2.S1'],
  ['products.collections', '/stores/active/collections', ['catalog.collections.view'], 'P2.S3'],
  ['products.offers', '/stores/active/offers', ['offers.view'], 'P2.S5'],
  ['products.themes', '/stores/active/themes', ['store.builder.open'], 'P8.S6'],
  ['products.ab-tests', '/stores/active/ab-tests', ['store.landing-pages.view'], 'P8.S8'],
  ['analytics.overview', '/analytics', ['analytics.view'], 'P7.S1'],
  ['analytics.team', '/analytics/team', ['analytics.view'], 'P7.S1'],
  ['analytics.marketing', '/analytics/marketing', ['analytics.view'], 'P9.S4'],
  ['inventory.stock', '/inventory', ['inventory.stock.view'], 'P6.S1'],
  ['inventory.packaging', '/inventory/packaging', ['inventory.stock.view'], 'P6.S2'],
  ['inventory.movements', '/inventory/movements', ['inventory.stock.view'], 'P6.S1'],
  ['finance.report', '/finance', ['finance.records.view'], 'P6.S4'],
  ['finance.costs', '/finance/costs', ['finance.expenses.view'], 'P6.S4'],
  ['finance.products', '/finance/products', ['finance.records.view'], 'P6.S4'],
  ['finance.wilayas', '/finance/wilayas', ['finance.records.view'], 'P6.S4'],
  ['finance.ads', '/finance/ads', ['finance.records.view'], 'P6.S4'],
  ['finance.wallets', '/finance/wallets', ['finance.records.view'], 'P6.S3'],
  ['finance.study', '/finance/study', ['finance.records.view'], 'P6.S5'],
  ['team.members', '/team', ['team.members.view'], 'P1.S4'],
  ['team.distribution', '/team/distribution', ['team.members.view'], 'P4.S4'],
  ['team.roles', '/team/roles', ['team.roles.view'], 'P1.S3'],
  ['delivery', '/delivery', ['delivery.carriers.view', 'delivery.pricing.view'], 'P3.S1'],
  ['apps', '/apps', ['apps.view'], 'P9.S8b'],
  ['sourcing', '/sourcing', ['apps.cargo.view'], 'P9.S9'],
  ['settings.general', '/settings', ['settings.business.view'], 'P1.S5'],
  ['settings.pixels', '/stores/active/settings/pixels', ['store.stores.view'], 'P9.S3'],
  ['settings.domains', '/stores/active/settings/domains', ['store.domains.view'], 'P8.S9'],
  ['settings.billing', '/stores/active/settings/billing', ['settings.business.view'], 'P9.S1'],
  ['settings.statuses', '/stores/active/settings/statuses', ['store.stores.view'], 'P4.S1'],
  ['settings.locations', '/stores/active/settings/locations', ['inventory.stock.view'], 'P6.S2'],
  ['settings.spam', '/stores/active/settings/spam', ['store.stores.view'], 'P4.S6'],
];

const url = (leaf: (typeof SHELL_LEAVES)[number]): string =>
  leaf.storeScoped ? storePathFor(leaf.path, 'active') : leaf.path;

describe('the merchant navigation tree', () => {
  it('lists the groups in the plan order', () => {
    expect(SHELL_TREE.map((group) => group.id)).toEqual([
      'home',
      'orders',
      'tracking',
      'products',
      'analytics',
      'inventory',
      'finance',
      'team',
      'delivery',
      'apps',
      'sourcing',
      'settings',
    ]);
  });

  it('lists every leaf of the plan table, in order, with its URL, permissions and owner', () => {
    const actual = SHELL_LEAVES.map((leaf) => [leaf.id, url(leaf), leaf.permissions, leaf.ownerSession]);

    expect(actual).toEqual(EXPECTED.map(([id, path, permissions, owner]) => [id, path, permissions, owner]));
  });

  it('flattens the groups into SHELL_LEAVES in tree order', () => {
    expect(SHELL_LEAVES.map((leaf) => leaf.id)).toEqual(SHELL_TREE.flatMap((group) => group.leaves.map((l) => l.id)));
  });

  it('gives every leaf and group a title id under shell.nav', () => {
    for (const group of SHELL_TREE) {
      expect(group.titleId).toBe(`shell.nav.${group.id}`);
    }
    for (const leaf of SHELL_LEAVES) {
      expect(leaf.titleId).toBe(`shell.nav.${leaf.id}`);
    }
  });

  it('marks exactly the starred leaves as store-scoped', () => {
    const scoped = SHELL_LEAVES.filter((leaf) => leaf.storeScoped).map((leaf) => leaf.id);

    expect(scoped).toEqual(EXPECTED.filter(([, path]) => path.startsWith('/stores/active/')).map(([id]) => id));
  });

  it('keeps ids and URLs unique', () => {
    const ids = SHELL_LEAVES.map((leaf) => leaf.id);
    const urls = SHELL_LEAVES.map(url);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('never uses a stock route as a URL', () => {
    for (const leaf of SHELL_LEAVES) {
      expect(STOCK_ROUTES).not.toContain(url(leaf));
    }
  });

  it('sets no plan feature on any leaf today', () => {
    expect(SHELL_LEAVES.filter((leaf) => leaf.planFeature !== undefined)).toEqual([]);
  });

  it('models a link as a group holding one leaf of the same id', () => {
    const links = SHELL_TREE.filter((group) => group.leaves.length === 1);

    expect(links.map((group) => group.id)).toEqual(['home', 'delivery', 'apps', 'sourcing']);
    for (const group of links) {
      expect(group.leaves[0].id).toBe(group.id);
    }
  });
});
