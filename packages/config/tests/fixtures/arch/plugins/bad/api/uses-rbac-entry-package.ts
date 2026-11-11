import { rbacEntry } from '@cod/plugin-rbac';

/** Forbidden: the rbac entry point exports services; another plugin imports its guard entry only. */
export const usesRbacEntry = rbacEntry;
