import { normalizeEmail, passwordSchema, RESET_TOKEN_TTL_MS } from '@cod/shared';
import { accountLink } from '../domain/account-link';
import { RESET_PASSWORD_PATH } from '../domain/constants';
import { InvalidTokenError, PasswordPolicyError } from '../domain/errors';
import type {
  AccountPasswordsPort,
  AccountSessionsPort,
  AccountThrottlePort,
  OpenedSession,
} from '../domain/ports/account-credentials.port';
import type { AccountIdentityPort, AccountRecord } from '../domain/ports/account-identity.port';
import type { PasswordResetQueuePort } from '../domain/ports/auth-email-queue.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { ExternalIdentityPort } from '../domain/ports/external-identity.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PayloadSealerPort } from '../domain/ports/payload-sealer.port';
import type { SessionTerminatorPort } from '../domain/ports/session-terminator.port';
import type { AccountTokenService } from './account-token.service';
import type { AuthEmailService } from './auth-email.service';

/** What {@link PasswordResetService} works with. */
export interface PasswordResetPorts {
  readonly identity: Pick<
    AccountIdentityPort,
    'inTransaction' | 'findByEmail' | 'findByUserId' | 'markEmailVerified' | 'setProviderLinkUnproven'
  >;
  readonly passwords: Pick<AccountPasswordsPort, 'set'>;
  readonly external: Pick<ExternalIdentityPort, 'unlinkAll'>;
  readonly sessions: AccountSessionsPort;
  readonly terminator: Pick<SessionTerminatorPort, 'endOthers' | 'flushCache'>;
  readonly queue: PasswordResetQueuePort;
  readonly sealer: PayloadSealerPort;
  readonly throttle: Pick<AccountThrottlePort, 'spendForEmail' | 'clearLoginLockout'>;
  readonly tokens: Pick<AccountTokenService, 'issue' | 'consume' | 'voidOpen'>;
  readonly emails: Pick<AuthEmailService, 'enqueue'>;
  readonly clock: ClockPort;
  readonly dashboardUrl: string;
}

/** What a queued reset request holds, sealed: the typed address must not sit readable in the queue store. */
interface ResetRequestPayload {
  readonly email: string;
}

interface AppliedReset {
  readonly account: AccountRecord;
  readonly ended: readonly string[];
}

/** No session has this token, so `endOthers` ends them all. */
const NO_SESSION_KEPT = '';

/** Forgot password: our hashed token in place of the stock plaintext column (D21, D25). */
export class PasswordResetService {
  constructor(private readonly ports: PasswordResetPorts) {}

  /**
   * Only throttles and queues, so a known and an unknown email take the same path and the same time here (D27). The
   * worker runs {@link fulfil}.
   */
  async request(ctx: OperationContext, rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.ports.throttle.spendForEmail('reset-account', email);
    await this.ports.queue.enqueueResetRequest(ctx, this.ports.sealer.seal({ email }));
  }

  /** The worker's half of {@link request}: looks the email up and mails a link when it has an account. */
  async fulfil(ctx: OperationContext, sealed: string): Promise<void> {
    const { email } = this.ports.sealer.open(sealed) as ResetRequestPayload;
    const account = await this.ports.identity.findByEmail(ctx, email);
    if (account !== undefined) {
      await this.ports.identity.inTransaction(ctx, (transactional) => this.mailLink(transactional, account));
    }
  }

  /**
   * The password is checked before the token is spent, so a weak one costs the owner no second email. Sessions are
   * deleted with the password write, so a crash cannot leave one alive; the cache is flushed after the commit, because
   * evicting earlier would let a concurrent request re-cache a session from its still visible row.
   *
   * @throws PasswordPolicyError or InvalidTokenError.
   */
  async reset(ctx: OperationContext, token: string, password: string): Promise<OpenedSession> {
    if (!passwordSchema.safeParse(password).success) {
      throw new PasswordPolicyError();
    }
    const { identity, sessions, terminator, throttle } = this.ports;
    const { account, ended } = await identity.inTransaction(ctx, (transactional) =>
      this.apply(transactional, token, password),
    );
    await terminator.flushCache(ended);
    await throttle.clearLoginLockout(ctx, account.email);
    return sessions.open(ctx, account.userId);
  }

  private async mailLink(ctx: OperationContext, account: AccountRecord): Promise<void> {
    const { tokens, emails, dashboardUrl } = this.ports;
    const { token } = await tokens.issue(ctx, {
      userId: account.userId,
      purpose: 'password-reset',
      ttlMs: RESET_TOKEN_TTL_MS,
    });
    await emails.enqueue(ctx, {
      kind: 'password-reset',
      to: account.email,
      locale: account.locale,
      vars: { name: account.firstName, link: accountLink(dashboardUrl, RESET_PASSWORD_PATH, token) },
    });
  }

  private async apply(ctx: OperationContext, token: string, password: string): Promise<AppliedReset> {
    const { identity, passwords, terminator, tokens } = this.ports;
    const { userId } = await tokens.consume(ctx, 'password-reset', token);
    const account = userId === null ? undefined : await identity.findByUserId(ctx, userId);
    if (account === undefined) {
      throw new InvalidTokenError();
    }
    await passwords.set(ctx, account.userId, password);
    await tokens.voidOpen(ctx, account.userId, ['password-reset', 'email-change', 'oauth-ticket']);
    await this.settleProof(ctx, account);
    return { account, ended: await terminator.endOthers(ctx, String(account.userId), NO_SESSION_KEPT) };
  }

  /**
   * A provider login made on an unproven address may belong to whoever pre-registered it with this email, and the
   * owner's later verification click says nothing about that login. Only the owner of the mailbox can reset, so the
   * reset removes it; if the address was still unproven, the reset is also its first proof.
   */
  private async settleProof(ctx: OperationContext, account: AccountRecord): Promise<void> {
    const { identity, external, clock } = this.ports;
    if (account.emailVerifiedAt === null || account.providerLinkUnproven) {
      await external.unlinkAll(ctx, account.userId);
      await identity.setProviderLinkUnproven(ctx, account.administratorId, false);
    }
    if (account.emailVerifiedAt === null) {
      await identity.markEmailVerified(ctx, account.administratorId, clock.now());
    }
  }
}
