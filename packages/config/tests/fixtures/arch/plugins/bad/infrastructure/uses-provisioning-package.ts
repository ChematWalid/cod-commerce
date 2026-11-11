import { provisioningEntry } from '@cod/plugin-tenancy/provisioning';

/** Forbidden: a plugin other than rbac reaching the tenancy provisioning entry through the package name. */
export const usesProvisioningPackage = provisioningEntry;
