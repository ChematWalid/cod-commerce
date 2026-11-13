import { type AcceptInvitationInput, acceptInvitationSchema } from '@cod/shared';

/** What the invitee types on the accept page. */
export interface AcceptDraft {
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
}

export function emptyAcceptDraft(): AcceptDraft {
  return { firstName: '', lastName: '', password: '' };
}

/**
 * The accept body when the names and the password pass the server's own schema, else null. The password is
 * passed on untouched (never trimmed): it is the person's secret as typed.
 */
export function acceptInputOf(token: string, draft: AcceptDraft): AcceptInvitationInput | null {
  const parsed = acceptInvitationSchema.safeParse({ token, ...draft });
  return parsed.success ? parsed.data : null;
}
