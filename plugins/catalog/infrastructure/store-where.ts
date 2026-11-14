import type { StoreScope } from '../domain/store-scope';

/** The store half of a row filter; `TenantRepository` adds the business itself (ADR 0002). */
export const inStore = (scope: StoreScope): { storeId: string } => ({ storeId: scope.storeId });
