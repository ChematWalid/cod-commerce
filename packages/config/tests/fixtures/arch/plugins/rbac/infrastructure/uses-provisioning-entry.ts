import { provisioningEntry } from '../../tenancy/provisioning';

/** Allowed: rbac/infrastructure is the one consumer of the provisioning entry. */
export const rbacUsesProvisioningEntry = provisioningEntry;
