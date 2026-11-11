import { type PermissionKey, vendurePermissionName } from '@cod/shared';

/** Plugin permissions a catalog key also carries, so existing tenancy handlers keep working (D59, D96). */
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

/** The stock permissions in `grants` that are not on `reviewed`. */
export function unreviewedStockGrants(
  grants: Readonly<Partial<Record<string, readonly string[]>>>,
  stockPermissions: readonly string[],
  reviewed: readonly string[],
): string[] {
  const granted = new Set(Object.values(grants).flat());
  return stockPermissions.filter((name) => granted.has(name) && !reviewed.includes(name));
}

/** What a Vendure Role holds for these catalog keys: each key's name and its engine grants (D59). */
export function enginePermissionsFor(keys: readonly PermissionKey[]): string[] {
  return [...new Set(keys.flatMap((key) => [vendurePermissionName(key), ...(ENGINE_GRANTS[key] ?? [])]))];
}
