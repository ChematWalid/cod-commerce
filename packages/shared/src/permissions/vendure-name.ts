import { VENDURE_PERMISSION_PREFIX } from './constants';
import type { PermissionKey } from './catalog';

const SEGMENT_SEPARATOR = /[.-]/;

/**
 * Maps a dotted catalog key to its Vendure permission name: the prefix plus PascalCase
 * of the segments (`orders.cancel` becomes `CodOrdersCancel`). The GraphQL enum refuses
 * dots and the stored list refuses commas (D52).
 */
export function vendurePermissionName(key: PermissionKey): string {
  const words = key.split(SEGMENT_SEPARATOR).map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1));
  return `${VENDURE_PERMISSION_PREFIX}${words.join('')}`;
}
