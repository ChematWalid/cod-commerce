import { type PermissionKey, vendurePermissionName } from '@cod/shared';

/** Plugin permissions a catalog key also carries, so existing tenancy handlers keep working (D59, D97). */
export const ENGINE_GRANTS: Readonly<Partial<Record<PermissionKey, readonly string[]>>> = {
  'store.stores.view': ['ReadTenantStore'],
  'store.stores.create': ['CreateTenantStore'],
  'store.stores.archive': ['DeleteTenantStore'],
  'store.settings.edit': ['UpdateTenantStore'],
  'settings.business.view': ['ReadTenantBusiness'],
  'settings.business.edit': ['UpdateTenantBusiness'],
};

/**
 * The stock Vendure permissions each catalogue key may carry in {@link ENGINE_GRANTS}, each pair after a review of
 * what it opens. An allowlist, because a denylist misses whatever nobody thought of (D59); per key, like the plugin
 * list (D801).
 */
export const REVIEWED_STOCK_ENGINE_GRANTS: Readonly<Partial<Record<PermissionKey, readonly string[]>>> = {};

/**
 * The plugin permissions each catalogue key may carry in {@link ENGINE_GRANTS}, each pair after a review of the
 * handlers it guards: a key that carries a permission opens those handlers to every role holding the key, so a new
 * key for an already reviewed permission needs a review too (D59, D97, D801). The unit test fails on any pair of the
 * map missing here.
 */
export const REVIEWED_PLUGIN_ENGINE_GRANTS: Readonly<Partial<Record<PermissionKey, readonly string[]>>> = {
  'store.stores.view': ['ReadTenantStore'],
  'store.stores.create': ['CreateTenantStore'],
  'store.stores.archive': ['DeleteTenantStore'],
  'store.settings.edit': ['UpdateTenantStore'],
  'settings.business.view': ['ReadTenantBusiness'],
  'settings.business.edit': ['UpdateTenantBusiness'],
};

/** The `key→permission` pairs of `grants` that carry a stock permission not reviewed for that key (D59, D801). */
export function unreviewedStockGrants(
  grants: Readonly<Partial<Record<string, readonly string[]>>>,
  stockPermissions: readonly string[],
  reviewed: Readonly<Partial<Record<string, readonly string[]>>>,
): string[] {
  return unreviewedPairs(grants, reviewed, (name) => stockPermissions.includes(name));
}

/**
 * The `key→permission` pairs of `grants` that carry a plugin (non-stock) permission not reviewed for that key; stock
 * permissions are left to {@link unreviewedStockGrants}.
 */
export function unreviewedPluginGrants(
  grants: Readonly<Partial<Record<string, readonly string[]>>>,
  stockPermissions: readonly string[],
  reviewed: Readonly<Partial<Record<string, readonly string[]>>>,
): string[] {
  return unreviewedPairs(grants, reviewed, (name) => !stockPermissions.includes(name));
}

/** The `key→permission` pairs of `grants` whose permission is `inScope` and not reviewed for that key. */
function unreviewedPairs(
  grants: Readonly<Partial<Record<string, readonly string[]>>>,
  reviewed: Readonly<Partial<Record<string, readonly string[]>>>,
  inScope: (name: string) => boolean,
): string[] {
  return Object.entries(grants).flatMap(([key, names]) =>
    (names ?? [])
      .filter((name) => inScope(name) && !(reviewed[key] ?? []).includes(name))
      .map((name) => `${key}→${name}`),
  );
}

/** What a Vendure Role holds for these catalog keys: each key's name and its engine grants (D59). */
export function enginePermissionsFor(keys: readonly PermissionKey[]): string[] {
  return [...new Set(keys.flatMap((key) => [vendurePermissionName(key), ...(ENGINE_GRANTS[key] ?? [])]))];
}
