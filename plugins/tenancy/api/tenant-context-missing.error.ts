import { ForbiddenError } from '@vendure/core';

/** A tenant-scoped operation ran for a request that has no tenant: answered as Vendure's `FORBIDDEN`. */
export class TenantContextMissingError extends ForbiddenError {}
