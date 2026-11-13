import { memberAccessEntry } from '@cod/plugin-rbac/member-access';

/** Allowed: a Nest module file importing the rbac module class through the member-access entry (D206). */
export const imports = [memberAccessEntry];
