import { requirePermission } from '@cod/plugin-rbac/guard';

/** Forbidden: only api/ may import the rbac guard entry (D58). */
export const guardInApplication = requirePermission;
