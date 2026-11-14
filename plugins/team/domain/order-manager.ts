import type { Snowflake, StoreAccessKind } from '@cod/shared';
import type { MemberGrant } from './member-grant';
import type { TeamMemberDetails } from './member-details';
import type { TeamMember } from './team-member';

/** A member orders can be handed to (D209): active and receiving orders. P4.S4 narrows it by order permissions. */
export interface OrderManagerView {
  readonly id: Snowflake;
  readonly name: string | null;
  readonly maxOpenOrders: number | null;
  readonly storeAccess: StoreAccessKind;
  readonly storeIds: readonly Snowflake[];
}

/** Whether a member takes new orders now: active, and not stopped (D209). */
export const isOrderManager = (member: Pick<TeamMemberDetails, 'status' | 'receivingOrders'>): boolean =>
  member.status === 'active' && member.receivingOrders;

/** The fields the order distribution needs, field by field. */
export function toOrderManagerView(member: TeamMemberDetails): OrderManagerView {
  return {
    id: member.id,
    name: member.name,
    maxOpenOrders: member.maxOpenOrders,
    storeAccess: member.storeAccess,
    storeIds: member.storeIds,
  };
}

/**
 * Whether a member may be named an order manager of a product of `storeId` (D2114): a live, active member whose
 * current store access covers that store. Receiving orders is not required: a member who paused stays named.
 */
export function managesStore(
  member: Pick<TeamMember, 'status' | 'removedAt'>,
  grant: MemberGrant | undefined,
  storeId: Snowflake,
): boolean {
  if (member.status !== 'active' || member.removedAt !== null || grant === undefined) return false;
  return grant.storeAccess === 'all' || grant.storeIds.includes(storeId);
}
