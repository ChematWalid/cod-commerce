import type { AccountProfile, ProfileChange } from '../profile';
import type { OperationContext } from './operation-context';

/** Where profiles live. Always addressed by the signed-in user's id, never by an id from a request. */
export interface AccountProfileStorePort {
  find(ctx: OperationContext, userId: number): Promise<AccountProfile | undefined>;
  /** Writes `change` to the user's administrator. */
  save(ctx: OperationContext, userId: number, change: ProfileChange): Promise<void>;
}
