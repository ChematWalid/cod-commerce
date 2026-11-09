import { PLATFORM_STAFF_PERMISSION } from '@cod/shared';
import { CrudPermissionDefinition, PermissionDefinition } from '@vendure/core';

/** `CreateTenantBusiness`, `ReadTenantBusiness`, `UpdateTenantBusiness` and `DeleteTenantBusiness`. */
export const tenantBusinessPermission = new CrudPermissionDefinition('TenantBusiness');

/** `CreateTenantStore`, `ReadTenantStore`, `UpdateTenantStore` and `DeleteTenantStore`. */
export const tenantStorePermission = new CrudPermissionDefinition('TenantStore');

/** Marks platform employees; assignable so the superadmin role holds it, but never given to an Owner (D78). */
export const platformStaffPermission = new PermissionDefinition({
  name: PLATFORM_STAFF_PERMISSION,
  description: 'Marks a platform employee, who sees the platform tools in the dashboard',
  assignable: true,
});
