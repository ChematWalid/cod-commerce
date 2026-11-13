import type { MemberStatus, MemberTab } from '@cod/shared';
import { type Invitation, invitationStateOf } from './invitation';
import type { TeamMember } from './team-member';

/** A tab a member is listed under; `all` lists every member and is no member's own tab. */
export type MemberOwnTab = Exclude<MemberTab, 'all'>;

/** How a member's status reads in the list. */
export interface MemberStatusLabel {
  readonly tab: MemberOwnTab;
  /** An invited member whose invitation ran out: still Pending, so it can be resent or revoked. */
  readonly invitationExpired: boolean;
}

const TAB_OF_STATUS: Readonly<Record<MemberStatus, MemberOwnTab>> = {
  invited: 'pending',
  active: 'active',
  inactive: 'inactive',
};

/** The tab a member is listed under. */
export function tabOf(member: Pick<TeamMember, 'status'>): MemberOwnTab {
  return TAB_OF_STATUS[member.status];
}

/** The tab and the expired mark of a member, given its current invitation, if any. */
export function statusLabelOf(
  member: Pick<TeamMember, 'status'>,
  invitation: Invitation | undefined,
  now: Date,
): MemberStatusLabel {
  const expired =
    member.status === 'invited' && invitation !== undefined && invitationStateOf(invitation, now) === 'expired';
  return { tab: tabOf(member), invitationExpired: expired };
}
