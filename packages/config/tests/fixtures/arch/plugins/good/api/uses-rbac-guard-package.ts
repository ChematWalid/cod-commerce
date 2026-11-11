import { requirePermission } from '@cod/plugin-rbac/guard';

/** Allowed: an api/ file guarding its handlers through the rbac guard entry (D58). */
export const guardedBy = requirePermission;
