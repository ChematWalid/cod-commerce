import type { Snowflake, StoreAccessKind } from '@cod/shared';
import type { TeamMemberDetails } from './member-details';

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
