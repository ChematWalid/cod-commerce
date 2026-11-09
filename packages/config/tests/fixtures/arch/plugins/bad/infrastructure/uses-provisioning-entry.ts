import { provisioningEntry } from '../../tenancy/provisioning';

/** Forbidden: a plugin other than rbac reaching the tenancy provisioning entry. */
export const usesProvisioningEntry = provisioningEntry;
