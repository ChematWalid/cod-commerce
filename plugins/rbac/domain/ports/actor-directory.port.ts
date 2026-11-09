import type { TenantScope } from '@cod/shared';
import type { OperationContext } from './operation-context';

/** The administrators of one business. */
export interface ActorDirectoryPort {
  /** The name of each of these administrators that belongs to the business, departed ones too. Any other id is absent. */
  namesOf(ctx: OperationContext, scope: TenantScope, ids: readonly number[]): Promise<ReadonlyMap<number, string>>;

  /** Whether the id names a current administrator of the business. */
  isMember(ctx: OperationContext, scope: TenantScope, administratorId: number): Promise<boolean>;
}
