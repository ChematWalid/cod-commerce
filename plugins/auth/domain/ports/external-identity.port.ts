import type { OAuthProviderName } from '../oauth';
import type { OperationContext } from './operation-context';

/** The provider subjects linked to accounts. */
export interface ExternalIdentityPort {
  /** The user this subject is linked to. */
  findUserId(ctx: OperationContext, provider: OAuthProviderName, subject: string): Promise<number | undefined>;
  link(ctx: OperationContext, userId: number, provider: OAuthProviderName, subject: string): Promise<void>;
  /** Removes every provider login of this user. */
  unlinkAll(ctx: OperationContext, userId: number): Promise<void>;
}
