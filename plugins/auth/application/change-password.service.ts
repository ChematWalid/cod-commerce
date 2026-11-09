import { InvalidTokenError } from '../domain/errors';
import type { AccountPasswordsPort, AccountThrottlePort } from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord } from '../domain/ports/account-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** What {@link ChangePasswordService} works with. */
export interface ChangePasswordPorts {
  readonly identity: Pick<AccountIdentityPort, 'inTransaction' | 'findByUserId'>;
  readonly passwords: Pick<AccountPasswordsPort, 'change'>;
  readonly terminator: Pick<SessionTerminatorPort, 'endOthers' | 'flushCache'>;
  readonly throttle: Pick<AccountThrottlePort, 'spendForUser'>;
  readonly tokens: Pick<AccountTokenService, 'voidOpen'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
}

/** What {@link ChangePasswordService.change} takes. */
export interface ChangePasswordCommand {
  readonly userId: number;
  readonly currentPassword: string;
  readonly newPassword: string;
  /** The caller's session token: the one session that survives. */
  readonly keepSessionToken: string;
}

/** A signed-in owner changing the password; every other session ends at once (Review Focus 3). */
export class ChangePasswordService {
  constructor(private readonly ports: ChangePasswordPorts) {}

  /**
   * The cache is flushed after the commit, so that no concurrent request can re-cache a session from a row the
   * transaction has not yet removed for others to see.
   *
   * @throws CurrentPasswordWrongError or PasswordPolicyError; a rate-limit error once guesses run out.
   */
  async change(ctx: OperationContext, command: ChangePasswordCommand): Promise<void> {
    const { identity, terminator, throttle } = this.ports;
    await throttle.spendForUser('current-password-account', command.userId);
    const ended = await identity.inTransaction(ctx, (transactional) => this.apply(transactional, command));
    await terminator.flushCache(ended);
  }

  private async apply(ctx: OperationContext, command: ChangePasswordCommand): Promise<string[]> {
    const { identity, passwords, terminator, tokens, emails } = this.ports;
    const { userId, currentPassword, newPassword, keepSessionToken } = command;
    const account: AccountRecord | undefined = await identity.findByUserId(ctx, userId);
    if (account === undefined) {
      throw new InvalidTokenError();
    }
    await passwords.change(ctx, userId, currentPassword, newPassword);
    await tokens.voidOpen(ctx, userId, ['password-reset', 'email-change']);
    const ended = await terminator.endOthers(ctx, String(userId), keepSessionToken);
    await emails.enqueue(ctx, {
      kind: 'password-changed',
      to: account.email,
      locale: account.locale,
      vars: { name: account.firstName },
    });
    return ended;
  }
}
