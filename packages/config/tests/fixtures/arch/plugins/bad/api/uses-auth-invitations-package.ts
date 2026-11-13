import { invitationsEntry } from '@cod/plugin-auth/invitations';

/** Forbidden: api/ goes through application/, never the auth invitations entry (D206). */
export const invitationsInApi = invitationsEntry;
