import type { FeatureKey, PermissionKey } from '@cod/shared';
import { ACTIVE_STORE_ALIAS, storePathFor } from './store-path';
import type { ShellIconName } from './types';

/**
 * A page of the merchant sidebar. `path` is a URL for an account-level leaf and, for a store-scoped one, the path
 * below `/stores/<store>/` without a leading slash. `planFeature` is unset on every leaf and unread today: P9.S1 sets
 * it and adds the gate. `ownerSession` names the session that builds the page, `null` when none does yet.
 */
export interface ShellLeaf<Id extends string = string> {
  readonly id: Id;
  readonly titleId: string;
  readonly path: string;
  readonly permissions: readonly PermissionKey[];
  readonly planFeature?: FeatureKey;
  readonly storeScoped: boolean;
  readonly ownerSession: string | null;
  readonly icon?: ShellIconName;
}

/** A sidebar group. A link (Home, Delivery & shipping, Apps, Sourcing) is a group holding one leaf of its own id. */
export interface ShellGroup<
  Id extends ShellIconName = ShellIconName,
  Leaves extends readonly ShellLeaf[] = readonly ShellLeaf[],
> {
  readonly id: Id;
  readonly titleId: string;
  readonly icon: ShellIconName;
  readonly leaves: Leaves;
}

/** Title ids are `shell.nav.<id>`; the catalogues under `dashboard/i18n` carry the wording. */
const titleIdOf = (id: string): string => `shell.nav.${id}`;

function leaf<const Id extends string>(
  id: Id,
  path: string,
  permissions: readonly PermissionKey[],
  ownerSession: string,
): ShellLeaf<Id> {
  return { id, titleId: titleIdOf(id), path, permissions, storeScoped: false, ownerSession };
}

/** A leaf below `/stores/active/`: the current store's page (D82). */
function storeLeaf<const Id extends string>(
  id: Id,
  path: string,
  permissions: readonly PermissionKey[],
  ownerSession: string,
): ShellLeaf<Id> {
  return { ...leaf(id, path, permissions, ownerSession), storeScoped: true };
}

function group<const Id extends ShellIconName, const Leaves extends readonly ShellLeaf[]>(
  id: Id,
  leaves: Leaves,
): ShellGroup<Id, Leaves> {
  return { id, titleId: titleIdOf(id), icon: id, leaves };
}

/**
 * The merchant sidebar, in display order (D80, D81). A group header only expands, so a group's parent page is its first
 * leaf. Paths avoid the stock routes (`/orders` would swallow `/orders/customers`); a unit test enforces it.
 */
export const SHELL_TREE = [
  group('home', [leaf('home', '/home', [], 'P7.S2')]),
  group('orders', [
    leaf('orders.all', '/cod-orders', ['orders.view'], 'P4.S2'),
    leaf('orders.customers', '/cod-orders/customers', ['orders.customers.view'], 'P4.S7'),
    leaf('orders.spam', '/cod-orders/spam', ['orders.view'], 'P4.S5'),
  ]),
  group('tracking', [
    leaf('tracking.shipments', '/tracking', ['tracking.view'], 'P5.S2'),
    leaf('tracking.returns', '/tracking/returns', ['orders.returns.view'], 'P5.S3'),
  ]),
  group('products', [
    storeLeaf('products.all', 'products', ['catalog.products.view'], 'P2.S1'),
    storeLeaf('products.collections', 'collections', ['catalog.collections.view'], 'P2.S3'),
    storeLeaf('products.offers', 'offers', ['offers.view'], 'P2.S5'),
    storeLeaf('products.themes', 'themes', ['store.builder.open'], 'P8.S6'),
    storeLeaf('products.ab-tests', 'ab-tests', ['store.landing-pages.view'], 'P8.S8'),
  ]),
  group('analytics', [
    leaf('analytics.overview', '/analytics', ['analytics.view'], 'P7.S1'),
    leaf('analytics.team', '/analytics/team', ['analytics.view'], 'P7.S1'),
    leaf('analytics.marketing', '/analytics/marketing', ['analytics.view'], 'P9.S4'),
  ]),
  group('inventory', [
    leaf('inventory.stock', '/inventory', ['inventory.stock.view'], 'P6.S1'),
    leaf('inventory.packaging', '/inventory/packaging', ['inventory.stock.view'], 'P6.S2'),
    leaf('inventory.movements', '/inventory/movements', ['inventory.stock.view'], 'P6.S1'),
  ]),
  group('finance', [
    leaf('finance.report', '/finance', ['finance.records.view'], 'P6.S4'),
    leaf('finance.costs', '/finance/costs', ['finance.expenses.view'], 'P6.S4'),
    leaf('finance.products', '/finance/products', ['finance.records.view'], 'P6.S4'),
    leaf('finance.wilayas', '/finance/wilayas', ['finance.records.view'], 'P6.S4'),
    leaf('finance.ads', '/finance/ads', ['finance.records.view'], 'P6.S4'),
    leaf('finance.wallets', '/finance/wallets', ['finance.records.view'], 'P6.S3'),
    leaf('finance.study', '/finance/study', ['finance.records.view'], 'P6.S5'),
  ]),
  group('team', [
    leaf('team.members', '/team', ['team.members.view'], 'P1.S4'),
    leaf('team.distribution', '/team/distribution', ['team.members.view'], 'P4.S4'),
    leaf('team.roles', '/team/roles', ['team.roles.view'], 'P1.S3'),
  ]),
  group('delivery', [leaf('delivery', '/delivery', ['delivery.carriers.view', 'delivery.pricing.view'], 'P3.S1')]),
  group('apps', [leaf('apps', '/apps', ['apps.view'], 'P9.S8b')]),
  group('sourcing', [leaf('sourcing', '/sourcing', ['apps.cargo.view'], 'P9.S9')]),
  group('settings', [
    leaf('settings.general', '/settings', ['settings.business.view'], 'P1.S5'),
    storeLeaf('settings.pixels', 'settings/pixels', ['store.stores.view'], 'P9.S3'),
    storeLeaf('settings.domains', 'settings/domains', ['store.domains.view'], 'P8.S9'),
    storeLeaf('settings.billing', 'settings/billing', ['settings.business.view'], 'P9.S1'),
    storeLeaf('settings.statuses', 'settings/statuses', ['store.stores.view'], 'P4.S1'),
    storeLeaf('settings.locations', 'settings/locations', ['inventory.stock.view'], 'P6.S2'),
    storeLeaf('settings.spam', 'settings/spam', ['store.stores.view'], 'P4.S6'),
  ]),
] as const;

/** The id of any leaf of the {@link SHELL_TREE}: a typo in `registerShellPage` fails `typecheck`. */
export type ShellLeafId = (typeof SHELL_TREE)[number]['leaves'][number]['id'];

/** Every leaf, in tree order. */
export const SHELL_LEAVES: readonly ShellLeaf<ShellLeafId>[] = SHELL_TREE.flatMap<ShellLeaf<ShellLeafId>>(
  (entry) => entry.leaves,
);

/** The sidebar URL of a leaf: a store-scoped leaf links to the current store (`/stores/active/…`). */
export function shellLeafUrl(entry: ShellLeaf): string {
  return entry.storeScoped ? storePathFor(entry.path, ACTIVE_STORE_ALIAS) : entry.path;
}
