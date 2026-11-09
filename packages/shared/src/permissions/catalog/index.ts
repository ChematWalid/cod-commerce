import type { PermissionDefinition } from '../types';
import { ORDERS_PERMISSIONS } from './orders';
import { CATALOG_PERMISSIONS, INVENTORY_PERMISSIONS, OFFERS_PERMISSIONS, TRACKING_PERMISSIONS } from './products';
import { ANALYTICS_PERMISSIONS, DELIVERY_PERMISSIONS, FINANCE_PERMISSIONS, TEAM_PERMISSIONS } from './operations';
import { APPS_PERMISSIONS, SETTINGS_PERMISSIONS, STORE_PERMISSIONS } from './storefront';

const DECLARED = [
  ...ORDERS_PERMISSIONS,
  ...TRACKING_PERMISSIONS,
  ...CATALOG_PERMISSIONS,
  ...OFFERS_PERMISSIONS,
  ...INVENTORY_PERMISSIONS,
  ...FINANCE_PERMISSIONS,
  ...ANALYTICS_PERMISSIONS,
  ...TEAM_PERMISSIONS,
  ...DELIVERY_PERMISSIONS,
  ...STORE_PERMISSIONS,
  ...APPS_PERMISSIONS,
  ...SETTINGS_PERMISSIONS,
] as const;

/** Every permission key, as a literal union. */
export type PermissionKey = (typeof DECLARED)[number]['key'];

/** One entry of {@link PERMISSION_CATALOG}. */
export type PermissionDefinitionEntry = PermissionDefinition<PermissionKey>;

/** The 93 permissions, grouped by area in display order. */
export const PERMISSION_CATALOG: readonly PermissionDefinitionEntry[] = DECLARED;

const KEY_SET: ReadonlySet<string> = new Set(DECLARED.map((entry) => entry.key));

/** True when `value` is a catalog key. */
export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && KEY_SET.has(value);
}
