import type { TeamEmailLocale } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** One invitation email: the raw token goes into the link only, never into storage or logs (D205). */
export interface InvitationMail {
  readonly to: string;
  readonly locale: TeamEmailLocale;
  readonly token: string;
  readonly inviterName: string;
  readonly businessName: string;
}

/** Sends invitation emails through the platform's mail queue. */
export interface InvitationMailPort {
  sendInvitation(ctx: OperationContext, mail: InvitationMail): Promise<void>;
}
