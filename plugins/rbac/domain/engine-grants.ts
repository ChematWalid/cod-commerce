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
 * Stock Vendure permissions that may appear in {@link ENGINE_GRANTS}, each after a review of what it opens. An
 * allowlist, because a denylist misses whatever nobody thought of (D59).
 */
export const REVIEWED_STOCK_ENGINE_GRANTS: readonly string[] = [];

/**
 * Plugin permissions that may appear in {@link ENGINE_GRANTS}, each after a review of the handlers it guards: a
 * catalogue key that carries one opens those handlers to every role holding the key (D59, D97, D801). A new entry
 * in the map fails the unit test until its permission is listed here.
 */
export const REVIEWED_PLUGIN_ENGINE_GRANTS: readonly string[] = [
  'ReadTenantStore',
  'CreateTenantStore',
  'DeleteTenantStore',
  'UpdateTenantStore',
  'ReadTenantBusiness',
  'UpdateTenantBusiness',
];

/** The stock permissions in `grants` that are not on `reviewed`. */
export function unreviewedStockGrants(
  grants: Readonly<Partial<Record<string, readonly string[]>>>,
  stockPermissions: readonly string[],
  reviewed: readonly string[],
): string[] {
  const granted = new Set(Object.values(grants).flat());
  return stockPermissions.filter((name) => granted.has(name) && !reviewed.includes(name));
}

/** The plugin (non-stock) permissions in `grants` that are not on `reviewed`; stock ones are left to {@link unreviewedStockGrants}. */
export function unreviewedPluginGrants(
  grants: Readonly<Partial<Record<string, readonly string[]>>>,
  stockPermissions: readonly string[],
  reviewed: readonly string[],
): string[] {
  const granted = new Set(Object.values(grants).flatMap((names) => names ?? []));
  return [...granted].filter((name) => !stockPermissions.includes(name) && !reviewed.includes(name));
}

/** What a Vendure Role holds for these catalog keys: each key's name and its engine grants (D59). */
export function enginePermissionsFor(keys: readonly PermissionKey[]): string[] {
  return [...new Set(keys.flatMap((key) => [vendurePermissionName(key), ...(ENGINE_GRANTS[key] ?? [])]))];
}
