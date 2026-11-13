import { invitationsEntry } from '@cod/plugin-auth/invitations';

/** Allowed: a Nest module file importing the auth module class through the invitations entry (D206). */
export const imports = [invitationsEntry];
