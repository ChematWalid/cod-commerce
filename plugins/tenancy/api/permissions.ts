import { CrudPermissionDefinition } from '@vendure/core';

/** `CreateTenantBusiness`, `ReadTenantBusiness`, `UpdateTenantBusiness` and `DeleteTenantBusiness`. */
export const tenantBusinessPermission = new CrudPermissionDefinition('TenantBusiness');

/** `CreateTenantStore`, `ReadTenantStore`, `UpdateTenantStore` and `DeleteTenantStore`. */
export const tenantStorePermission = new CrudPermissionDefinition('TenantStore');
