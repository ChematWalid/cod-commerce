import { memberAccessEntry } from '@cod/plugin-rbac/member-access';

/** Forbidden: application/ reaches rbac through a port, never the member-access entry (D206). */
export const accessInApplication = memberAccessEntry;
