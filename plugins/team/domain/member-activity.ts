import { MEMBER_NAME_MAX_LENGTH, type TeamMemberActivityDiff } from '@cod/shared';
import type { TeamMember } from './team-member';

/** A member field an activity row may name as changed, never with its value (D216). */
export type MemberActivityField = TeamMemberActivityDiff['changedFields'][number];

/**
 * How an activity row names a member: its full name, or `null` while it has none. Never an address (D216): a name
 * that holds `@` is dropped, and a long one is cut to fit.
 */
export function activityNameOf(member: Pick<TeamMember, 'firstName' | 'lastName'>): string | null {
  const name = [member.firstName, member.lastName]
    .filter((part): part is string => part !== null)
    .join(' ')
    .trim();
  if (name === '' || name.includes('@')) return null;
  return Array.from(name).slice(0, MEMBER_NAME_MAX_LENGTH).join('').trim();
}

/** The whole diff of a member's activity row (D216). */
export function memberActivityDiff(
  member: Pick<TeamMember, 'id' | 'firstName' | 'lastName'>,
  changedFields: readonly MemberActivityField[],
): TeamMemberActivityDiff {
  return { memberId: member.id, displayName: activityNameOf(member), changedFields: [...changedFields] };
}
