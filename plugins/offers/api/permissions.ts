import type { PermissionKey } from '@cod/shared';

/**
 * The offer keys the handlers require (D2517): no new key, the `offers.*` ones of the permission catalogue. Status
 * moves and codes are edits; a duplicate is a create.
 */
export const OFFER_PERMISSIONS = {
  view: 'offers.view',
  create: 'offers.create',
  edit: 'offers.edit',
  delete: 'offers.delete',
} as const satisfies Record<string, PermissionKey>;
