import type { AuthEmailLocale } from '../email';
import type { OperationContext } from './operation-context';

/** An administrator account as the email and password flows see it. */
export interface AccountRecord {
  readonly userId: number;
  readonly administratorId: number;
  readonly firstName: string;
  readonly email: string;
  readonly locale: AuthEmailLocale;
  readonly emailVerifiedAt: Date | null;
  /** A provider login was linked while nobody had proven this address; a later verification does not clear it. */
  readonly providerLinkUnproven: boolean;
  /** Null for a platform administrator, who belongs to no business. */
  readonly businessId: string | null;
}

/** The accounts of the commerce engine, as the account flows need them. */
export interface AccountIdentityPort {
  /** Runs `work` in one transaction; everything in it must use the context it receives. */
  inTransaction<T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>): Promise<T>;
  /** Whether a live administrator holds this normalised email. */
  isEmailTaken(ctx: OperationContext, email: string): Promise<boolean>;
  setEmailLocale(ctx: OperationContext, administratorId: number, locale: AuthEmailLocale): Promise<void>;
  userIdOfAdministrator(ctx: OperationContext, administratorId: number): Promise<number>;
  /** The live administrator holding this normalised email. */
  findByEmail(ctx: OperationContext, email: string): Promise<AccountRecord | undefined>;
  /** The live administrator of this user. */
  findByUserId(ctx: OperationContext, userId: number): Promise<AccountRecord | undefined>;
  markEmailVerified(ctx: OperationContext, administratorId: number, at: Date): Promise<void>;
  setProviderLinkUnproven(ctx: OperationContext, administratorId: number, unproven: boolean): Promise<void>;
  /** Moves the administrator, the user and the native login to `email` together. */
  changeEmail(ctx: OperationContext, account: AccountRecord, email: string): Promise<void>;
}

/** Serialises everything that claims one email address (D41). */
export interface EmailClaimPort {
  /** Holds the claim until the transaction in `ctx` ends, so it must be called inside one. */
  claim(ctx: OperationContext, email: string): Promise<void>;
}
