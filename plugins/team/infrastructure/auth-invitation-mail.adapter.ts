import { asOperationContext as asAuthContext, AuthEmailService } from '@cod/plugin-auth/invitations';
import { Inject, Injectable } from '@nestjs/common';
import { INVITATION_LINK_BASE } from '../application/tokens';
import type { InvitationMail, InvitationMailPort } from '../domain/ports/invitation-mail.port';
import type { OperationContext } from '../domain/ports/operation-context';
import { toRequestContext } from './request-scope';

/** The dashboard page an invitation link opens (D205); the page strips the token from the address bar. */
export const ACCEPT_INVITATION_PATH = '/accept-invitation';

/** The link of an invitation email: the raw token rides in the query string only (D205). */
export function invitationLinkOf(dashboardUrl: string, token: string): string {
  const link = new URL(`${dashboardUrl.replace(/\/+$/, '')}${ACCEPT_INVITATION_PATH}`);
  link.searchParams.set('token', token);
  return link.toString();
}

/** {@link InvitationMailPort} on auth's email queue: sealed in the queue, sent after the caller's commit (D203). */
@Injectable()
export class AuthInvitationMailAdapter implements InvitationMailPort {
  constructor(
    private readonly emails: AuthEmailService,
    @Inject(INVITATION_LINK_BASE) private readonly dashboardUrl: string,
  ) {}

  async sendInvitation(ctx: OperationContext, mail: InvitationMail): Promise<void> {
    await this.emails.enqueue(asAuthContext(toRequestContext(ctx)), {
      kind: 'team-invitation',
      to: mail.to,
      locale: mail.locale,
      vars: {
        inviter: mail.inviterName,
        business: mail.businessName,
        link: invitationLinkOf(this.dashboardUrl, mail.token),
      },
    });
  }
}
