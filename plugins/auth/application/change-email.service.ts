import { EMAIL_CHANGE_TTL_MS, emailSchema, RESEND_COOLDOWN_MS } from '@cod/shared';
import { accountLink } from '../domain/account-link';
import {
  CONFIRM_EMAIL_CHANGE_PATH,
  CREDENTIAL_TAKEOVER_VOIDED_PURPOSES,
  PENDING_EMAIL_MAX_LENGTH,
} from '../domain/constants';
import { CurrentPasswordWrongError, EmailInvalidError, InvalidTokenError } from '../domain/errors';
import type { AccountPasswordsPort, AccountThrottlePort } from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord, EmailClaimPort } from '../domain/ports/account-identity.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** What {@link ChangeEmailService} works with. */
export interface ChangeEmailPorts {
  readonly identity: Pick<
    AccountIdentityPort,
    'inTransaction' | 'findByUserId' | 'isEmailTaken' | 'markEmailVerified' | 'changeEmail'
  >;
  readonly claims: EmailClaimPort;
  readonly passwords: Pick<AccountPasswordsPort, 'verify'>;
  readonly throttle: Pick<AccountThrottlePort, 'spendForUser'>;
  readonly tokens: Pick<AccountTokenService, 'issueAfterCooldown' | 'consume' | 'voidOpen'>;
  readonly terminator: Pick<SessionTerminatorPort, 'endOthers' | 'flushCache'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
  readonly clock: ClockPort;
  readonly dashboardUrl: string;
}

/** What {@link ChangeEmailService.request} takes. */
export interface RequestEmailChangeCommand {
  readonly userId: number;
  readonly newEmail: string;
  readonly currentPassword: string;
}

function parseEmail(raw: string): string {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success || parsed.data.length > PENDING_EMAIL_MAX_LENGTH) {
    throw new EmailInvalidError();
  }
  return parsed.data;
}

/** Moves an account to a new email, which switches only once the new mailbox confirms. */
export class ChangeEmailService {
  constructor(private readonly ports: ChangeEmailPorts) {}

  /**
   * A taken target writes the same pending row and starts the same cooldown as a free one, and only its confirmation
   * stays unsent, so neither the answer nor `accountStatus` reveal who holds an address (D27).
   *
   * @throws EmailInvalidError, CurrentPasswordWrongError, CooldownError; a rate-limit error once guesses run out.
   */
  async request(ctx: OperationContext, command: RequestEmailChangeCommand): Promise<void> {
    const { userId, currentPassword } = command;
    const newEmail = parseEmail(command.newEmail);
    await this.ports.throttle.spendForUser('current-password-account', userId);
    if (!(await this.ports.passwords.verify(ctx, userId, currentPassword))) {
      throw new CurrentPasswordWrongError();
    }
    await this.ports.identity.inTransaction(ctx, (transactional) => this.record(transactional, userId, newEmail));
  }

  /**
   * Holds the claim on the address for the switch (D41), so a registration cannot take it at the same moment. The
   * cache is flushed after the commit: evicting earlier would let a concurrent request re-cache a session from its
   * still visible row.
   *
   * @param keepSessionToken The confirming session, when there is one; every other session of the account ends.
   * @throws InvalidTokenError for a bad token, and for a target taken since the request.
   */
  async confirm(ctx: OperationContext, token: string, keepSessionToken: string): Promise<void> {
    const ended = await this.ports.identity.inTransaction(ctx, (transactional) =>
      this.applyChange(transactional, token, keepSessionToken),
    );
    await this.ports.terminator.flushCache(ended);
  }

  private async record(ctx: OperationContext, userId: number, newEmail: string): Promise<void> {
    const { identity, tokens, emails } = this.ports;
    const account = await identity.findByUserId(ctx, userId);
    if (account === undefined) {
      throw new InvalidTokenError();
    }
    const { token } = await tokens.issueAfterCooldown(
      ctx,
      { userId, purpose: 'email-change', ttlMs: EMAIL_CHANGE_TTL_MS, pendingEmail: newEmail },
      RESEND_COOLDOWN_MS,
    );
    if (!(await identity.isEmailTaken(ctx, newEmail))) {
      await this.mailConfirmation(ctx, account, newEmail, token);
    }
    await emails.enqueue(ctx, {
      kind: 'email-change-notice',
      to: account.email,
      locale: account.locale,
      vars: { name: account.firstName, newEmail },
    });
  }

  private async mailConfirmation(
    ctx: OperationContext,
    account: AccountRecord,
    newEmail: string,
    token: string,
  ): Promise<void> {
    await this.ports.emails.enqueue(ctx, {
      kind: 'email-change-confirm',
      to: newEmail,
      locale: account.locale,
      vars: {
        name: account.firstName,
        link: accountLink(this.ports.dashboardUrl, CONFIRM_EMAIL_CHANGE_PATH, token),
        newEmail,
      },
    });
  }

  private async applyChange(
    ctx: OperationContext,
    token: string,
    keepSessionToken: string,
  ): Promise<readonly string[]> {
    const { identity, claims, tokens, clock, terminator } = this.ports;
    const { userId, pendingEmail } = await tokens.consume(ctx, 'email-change', token);
    const account = userId === null ? undefined : await identity.findByUserId(ctx, userId);
    if (account === undefined || pendingEmail === null) {
      throw new InvalidTokenError();
    }
    await claims.claim(ctx, pendingEmail);
    if (await identity.isEmailTaken(ctx, pendingEmail)) {
      throw new InvalidTokenError();
    }
    await identity.changeEmail(ctx, account, pendingEmail);
    await identity.markEmailVerified(ctx, account.administratorId, clock.now());
    await tokens.voidOpen(ctx, account.userId, CREDENTIAL_TAKEOVER_VOIDED_PURPOSES);
    return terminator.endOthers(ctx, String(account.userId), keepSessionToken);
  }
}
