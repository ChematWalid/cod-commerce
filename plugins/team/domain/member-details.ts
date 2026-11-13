import type { Snowflake, StoreAccessKind } from '@cod/shared';
import { ORDER_COUNT_PLACEHOLDER } from './constants';
import type { Invitation } from './invitation';
import type { MemberGrant } from './member-grant';
import { type MemberOwnTab, statusLabelOf } from './member-status';
import { type TeamMember, type TeamMemberView, type TeamMemberViewOptions, toTeamMemberView } from './team-member';

/** A role a member holds or is to hold, by name. */
export interface MemberRoleView {
  readonly id: Snowflake;
  readonly name: string;
}

/** A member as the members list and the member page show it (brief step 3). */
export interface TeamMemberDetails extends TeamMemberView {
  /** First and last name, or `null` before the invitee gave them. */
  readonly name: string | null;
  readonly tab: MemberOwnTab;
  readonly invitationExpired: boolean;
  readonly roles: readonly MemberRoleView[];
  readonly storeAccess: StoreAccessKind;
  readonly storeIds: readonly Snowflake[];
  /** Names of `storeIds`, in the same order; empty for all-store access. */
  readonly storeNames: readonly string[];
  /** Always {@link ORDER_COUNT_PLACEHOLDER} until orders exist. */
  readonly ordersCount: number;
}

/** The grant of a member that holds nothing: no role, no store. */
export const NO_GRANT: MemberGrant = { roleIds: [], storeAccess: 'selected', storeIds: [] };

/**
 * The roles and stores a member holds or is to hold (D204): an invited member's invitation grant, an inactive
 * member's snapshot, an active member's access in rbac (`held`).
 */
export function grantOfMember(
  member: Pick<TeamMember, 'status' | 'suspendedAccess'>,
  invitation: Invitation | undefined,
  held: MemberGrant | undefined,
): MemberGrant {
  if (member.status === 'invited') return invitation?.grant ?? NO_GRANT;
  if (member.status === 'inactive') return member.suspendedAccess ?? NO_GRANT;
  return held ?? NO_GRANT;
}

/** What a member's details are built from. */
export interface MemberDetailsSource {
  readonly member: TeamMember;
  readonly grant: MemberGrant;
  readonly invitation: Invitation | undefined;
  readonly roleNames: ReadonlyMap<Snowflake, string>;
  readonly storeNames: ReadonlyMap<Snowflake, string>;
  readonly now: Date;
}

/** Names the ids that still exist, in order: a role deleted since (D214) or a store gone is left out. */
function named<T>(
  ids: readonly Snowflake[],
  names: ReadonlyMap<Snowflake, string>,
  shape: (id: Snowflake, name: string) => T,
): T[] {
  return ids.flatMap((id) => {
    const name = names.get(id);
    return name === undefined ? [] : [shape(id, name)];
  });
}

/** A member's details; the salary follows {@link toTeamMemberView} (D207). */
export function toMemberDetails(source: MemberDetailsSource, options: TeamMemberViewOptions = {}): TeamMemberDetails {
  const { member, grant } = source;
  const name = [member.firstName, member.lastName].filter((part) => part !== null).join(' ');
  const storeIds = grant.storeAccess === 'all' ? [] : grant.storeIds;
  return {
    ...toTeamMemberView(member, options),
    ...statusLabelOf(member, source.invitation, source.now),
    name: name === '' ? null : name,
    roles: named(grant.roleIds, source.roleNames, (id, roleName) => ({ id, name: roleName })),
    storeAccess: grant.storeAccess,
    storeIds,
    storeNames: named(storeIds, source.storeNames, (_id, storeName) => storeName),
    ordersCount: ORDER_COUNT_PLACEHOLDER,
  };
}
