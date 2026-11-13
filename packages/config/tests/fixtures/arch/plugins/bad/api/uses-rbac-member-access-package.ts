import { memberAccessEntry } from '@cod/plugin-rbac/member-access';

/** Forbidden: api/ goes through application/, never the rbac member-access entry (D206). */
export const accessInApi = memberAccessEntry;
