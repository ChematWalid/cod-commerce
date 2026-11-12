import { normalizeEmail } from '@cod/shared';
import type { AuthEmailLocale } from '../domain/email';
import { EmailTakenError } from '../domain/errors';
import type { AccountIdentityPort, EmailClaimPort } from '../domain/ports/account-identity.port';
import type { ClockPort } from '../domain/ports/clock.port';
import type { OperationContext } from '../domain/ports/operation-context';

/** What {@link InvitedAccountService} works with. */
export interface InvitedAccountPorts {
  readonly identity: Pick<AccountIdentityPort, 'isEmailTaken' | 'markEmailVerified' | 'setEmailLocale'>;
  readonly claims: EmailClaimPort;
  readonly clock: ClockPort;
}

/**
 * The account side of accepting a Team invitation (D203). Auth owns the email claim lock (D41), `emailVerifiedAt`
 * and `emailLocale`; Team calls both methods inside its own accept transaction, in the order D213 fixes.
 */
export class InvitedAccountService {
  constructor(private readonly ports: InvitedAccountPorts) {}

  /**
   * Claims the address for the caller's transaction, then refuses it if a live administrator holds it. Vendure stores
   * addresses lower-cased, so the check compares the normalised form. Call it inside the transaction that creates the
   * account, so that a registration or another accept cannot take the address in between.
   *
   * @throws EmailTakenError when an account already uses the address.
   */
  async assertEmailFree(ctx: OperationContext, email: string): Promise<void> {
    const key = normalizeEmail(email);
    await this.ports.claims.claim(ctx, key);
    if (await this.ports.identity.isEmailTaken(ctx, key)) {
      throw new EmailTakenError();
    }
  }

  /**
   * Marks the invited administrator's address as proven, since the mailed one-time token reached it, and sets the
   * language of its emails. The unproven provider link flag is left as it is: no provider login is involved here.
   */
  async markInvitedVerified(ctx: OperationContext, administratorId: number, locale: AuthEmailLocale): Promise<void> {
    const { identity, clock } = this.ports;
    await identity.markEmailVerified(ctx, administratorId, clock.now());
    await identity.setEmailLocale(ctx, administratorId, locale);
  }
}
