/**
 * Entry point for platform code that reads across businesses or acts as the superadmin. Only `plugins/rbac/infrastructure`
 * may import it (architecture rule `tenancy-provisioning-entry-restricted`); every other plugin uses `index.ts`.
 */
export {
  BusinessStoreDirectory,
  type BusinessSummary,
  MAX_BUSINESS_PAGE_SIZE,
} from './domain/ports/business-store-directory.port';
export type { StoreAccess } from './domain/store';
export { SuperadminContextFactory } from './infrastructure/superadmin-context.factory';
