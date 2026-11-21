import type { PermissionKey } from '@cod/shared';

/** The catalogue keys the catalog-import handlers require (D2207): no new key; bulk edit needs edit. */
export const IMPORT_PERMISSIONS = {
  view: 'catalog.products.view',
  create: 'catalog.products.create',
  edit: 'catalog.products.edit',
} as const satisfies Record<string, PermissionKey>;
