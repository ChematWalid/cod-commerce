import type { Snowflake } from '@cod/shared';

/** The stores an actor reaches through its roles (D211); `allStores` also covers stores opened later. */
export interface ActorReachView {
  readonly allStores: boolean;
  readonly storeIds: readonly Snowflake[];
}

/**
 * Whether an actor may see and act on a member (D211): an all-store actor reaches everyone; a store-limited actor
 * reaches only members whose every store it reaches, never an all-store member.
 */
export function isMemberInReach(
  reach: ActorReachView,
  memberStoreIds: readonly Snowflake[],
  memberAllStores: boolean,
): boolean {
  if (reach.allStores) return true;
  if (memberAllStores) return false;
  const reached = new Set<string>(reach.storeIds);
  return memberStoreIds.every((storeId) => reached.has(storeId));
}
