import type { PermissionKey } from '@cod/shared';

/**
 * The catalogue keys the product handlers require (D2101): no new key, the existing `catalog.products.*` ones.
 * Updating a status is an edit.
 */
export const PRODUCT_PERMISSIONS = {
  view: 'catalog.products.view',
  create: 'catalog.products.create',
  edit: 'catalog.products.edit',
  delete: 'catalog.products.delete',
} as const satisfies Record<string, PermissionKey>;
