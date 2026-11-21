import type { PermissionKey } from '@cod/shared';

/** The catalogue keys the pack handlers require (D2207): no new key; reading needs view, saving and previewing edit. */
export const PACK_PERMISSIONS = {
  view: 'catalog.products.view',
  edit: 'catalog.products.edit',
} as const satisfies Record<string, PermissionKey>;
