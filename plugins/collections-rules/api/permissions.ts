import type { PermissionKey } from '@cod/shared';

/**
 * The catalogue keys the collection handlers require (D2101, D2314): no new key, the existing `catalog.collections.*`
 * ones. Deleting is the sensitive key.
 */
export const COLLECTION_PERMISSIONS = {
  view: 'catalog.collections.view',
  create: 'catalog.collections.create',
  edit: 'catalog.collections.edit',
  delete: 'catalog.collections.delete',
} as const satisfies Record<string, PermissionKey>;
