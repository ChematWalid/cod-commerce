import type { PermissionKey } from '@cod/shared';

/**
 * The catalogue permissions the notes handlers require. Roles are built from catalogue keys alone, so a permission
 * a plugin defines for itself would reach Owners and nobody else. The notes are a development-only demo with no
 * dashboard page (D2111) and add no key: they borrow the product keys. A real plugin names the keys of its own area,
 * adding them to `packages/shared/src/permissions/catalog/` when they are new.
 */
export const NOTE_PERMISSIONS = {
  view: 'catalog.products.view',
  create: 'catalog.products.create',
} as const satisfies Record<string, PermissionKey>;
