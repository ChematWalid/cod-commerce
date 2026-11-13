import { invitationsEntry } from '@cod/plugin-auth/invitations';

/** Forbidden: application/ reaches auth through a port, never the invitations entry (D206). */
export const invitationsInApplication = invitationsEntry;
