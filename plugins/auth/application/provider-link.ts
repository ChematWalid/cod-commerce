import type { AccountTokenPurpose } from '../domain/account-token';
import { OAuthEmailUnconfirmedError, OAuthLinkRequiresVerificationError } from '../domain/errors';
import type { OAuthIdentity } from '../domain/oauth';
import type { AccountPasswordsPort } from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord } from '../domain/ports/account-identity.port';
import type { ExternalIdentityPort } from '../domain/ports/external-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** What {@link ProviderLinker} works with. */
export interface ProviderLinkPorts {
  readonly identity: Pick<AccountIdentityPort, 'setProviderLinkUnproven'>;
  readonly external: Pick<ExternalIdentityPort, 'hasAny' | 'link' | 'unlinkAll'>;
  readonly passwords: Pick<AccountPasswordsPort, 'voidPassword'>;
  readonly terminator: Pick<SessionTerminatorPort, 'endOthers'>;
  readonly tokens: Pick<AccountTokenService, 'voidOpen'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
}

/** The tokens a takeover voids; the new sign-in ticket is issued after them. */
const TAKEOVER_VOIDED_PURPOSES: readonly AccountTokenPurpose[] = ['password-reset', 'email-change', 'oauth-ticket'];

/** No session has this token, so `endOthers` ends them all. */
const NO_SESSION_KEPT = '';

/** Links a provider login to an account that already holds its email (AUTH-2, D608). */
export class ProviderLinker {
  constructor(private readonly ports: ProviderLinkPorts) {}

  /**
   * Links `identity` to `holder`. When the account has no proven provider login yet, whoever set its password may not
   * be the mailbox owner the provider just vouched for, so the password, sessions and open tokens are voided and the
   * owner is told. Call it inside the sign-in's transaction.
   *
   * @returns the tokens of the ended sessions, for `flushCache` after the commit.
   * @throws OAuthLinkRequiresVerificationError or OAuthEmailUnconfirmedError when the account may not be linked.
   */
  async link(ctx: OperationContext, holder: AccountRecord, identity: OAuthIdentity): Promise<string[]> {
    assertLinkable(identity, holder);
    const firstProvenLink = await this.isFirstProvenLink(ctx, holder);
    const ended = firstProvenLink ? await this.revokeEarlierAccess(ctx, holder) : [];
    await this.ports.external.link(ctx, holder.userId, identity.provider, identity.subject);
    if (firstProvenLink) {
      await this.mailNotice(ctx, holder, identity);
    }
    return ended;
  }

  /** A link made while the address was unproven may be an attacker's, so it does not count (D50). */
  private async isFirstProvenLink(ctx: OperationContext, holder: AccountRecord): Promise<boolean> {
    return holder.providerLinkUnproven || !(await this.ports.external.hasAny(ctx, holder.userId));
  }

  private async revokeEarlierAccess(ctx: OperationContext, holder: AccountRecord): Promise<string[]> {
    const { identity, external, passwords, terminator, tokens } = this.ports;
    if (holder.providerLinkUnproven) {
      await external.unlinkAll(ctx, holder.userId);
      await identity.setProviderLinkUnproven(ctx, holder.administratorId, false);
    }
    await passwords.voidPassword(ctx, holder.userId);
    await tokens.voidOpen(ctx, holder.userId, TAKEOVER_VOIDED_PURPOSES);
    return terminator.endOthers(ctx, String(holder.userId), NO_SESSION_KEPT);
  }

  /** Queued in the sign-in's transaction, so a rolled-back link mails nothing. */
  private async mailNotice(ctx: OperationContext, holder: AccountRecord, identity: OAuthIdentity): Promise<void> {
    await this.ports.emails.enqueue(ctx, {
      kind: 'provider-linked',
      to: holder.email,
      locale: holder.locale,
      vars: { name: holder.firstName, provider: identity.provider },
    });
  }
}

/**
 * Linking hands the account to whoever holds the provider login. Both sides must have proven the address, or a
 * pre-set password or a provider account with someone else's email would take the account over. A platform
 * administrator is never linked: social sign-in must not reach that role.
 */
function assertLinkable(identity: OAuthIdentity, holder: AccountRecord): void {
  if (holder.emailVerifiedAt === null || holder.businessId === null) {
    throw new OAuthLinkRequiresVerificationError();
  }
  if (!identity.emailVerified) {
    throw new OAuthEmailUnconfirmedError();
  }
}
