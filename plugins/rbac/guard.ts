/**
 * Entry point for the handler guard alone (D58). Another plugin's `api/` imports `requirePermission` from here
 * (architecture rule `rbac-guard-entry-api-only`); `index.ts` exports services and stays closed to other plugins.
 */
export { requirePermission } from './api/require-permission.decorator';
