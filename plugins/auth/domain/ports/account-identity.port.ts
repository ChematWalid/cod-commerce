import type { AuthEmailLocale } from '../email';
import type { OperationContext } from './operation-context';

/** The accounts of the commerce engine, as registration needs them. */
export interface AccountIdentityPort {
  /** Runs `work` in one transaction; everything in it must use the context it receives. */
  inTransaction<T>(ctx: OperationContext, work: (transactional: OperationContext) => Promise<T>): Promise<T>;
  /** Whether a live administrator holds this normalised email. */
  isEmailTaken(ctx: OperationContext, email: string): Promise<boolean>;
  setEmailLocale(ctx: OperationContext, administratorId: number, locale: AuthEmailLocale): Promise<void>;
  userIdOfAdministrator(ctx: OperationContext, administratorId: number): Promise<number>;
}

/** Serialises everything that claims one email address (D41). */
export interface EmailClaimPort {
  /** Holds the claim until the transaction in `ctx` ends, so it must be called inside one. */
  claim(ctx: OperationContext, email: string): Promise<void>;
}
