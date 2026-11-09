import { PERMISSION_CATALOG, vendurePermissionName } from '@cod/shared';
import { PermissionDefinition } from '@vendure/core';

/** The 93 catalog permissions as Vendure permissions (D52). */
export const RBAC_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = PERMISSION_CATALOG.map(
  ({ key, label }) =>
    new PermissionDefinition({ name: vendurePermissionName(key), description: label.en, assignable: true }),
);
