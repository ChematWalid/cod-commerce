import { MEMBER_TABS, MEMBERS_PAGE_SIZE, type MemberTab } from '@cod/shared';
import type { MemberOwnTab } from './member-status';
import type { TeamMember } from './team-member';

/** What the list filters and searches a member by. */
export interface ListedMember {
  readonly tab: MemberOwnTab;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

/** A request for one page of the members list; `page` counts from 1. */
export interface MemberListQuery {
  readonly tab: MemberTab;
  readonly search?: string;
  readonly page: number;
}

/** One page of a tab, with the size of every tab under the same search. */
export interface MemberListPage<T> {
  readonly items: readonly T[];
  readonly counts: Readonly<Record<MemberTab, number>>;
  /** Members in the requested tab, all pages together. */
  readonly total: number;
}

const fold = (text: string): string => text.toLowerCase();

/**
 * Whether a member matches a search, by first name, last name, full name or email, ignoring case and surrounding
 * blanks. The text is compared as is: `%` and `_` are plain characters, never wildcards. A blank search matches all.
 */
export function matchesSearch(member: ListedMember, search: string | undefined): boolean {
  const needle = fold(search?.trim() ?? '');
  if (needle === '') return true;
  const fullName = [member.firstName, member.lastName].filter((part) => part !== null).join(' ');
  return [member.email, fullName, member.firstName ?? '', member.lastName ?? ''].some((field) =>
    fold(field).includes(needle),
  );
}

const inTab = (member: ListedMember, tab: MemberTab): boolean => tab === 'all' || member.tab === tab;

/**
 * The requested page of a tab, from members already in display order, with every tab's count under the same search,
 * so each tab badge equals the length of its list.
 */
export function pageOfMembers<T extends ListedMember>(
  members: readonly T[],
  query: MemberListQuery,
  pageSize: number = MEMBERS_PAGE_SIZE,
): MemberListPage<T> {
  const matching = members.filter((member) => matchesSearch(member, query.search));
  const counts = Object.fromEntries(
    MEMBER_TABS.map((tab) => [tab, matching.filter((member) => inTab(member, tab)).length]),
  ) as Record<MemberTab, number>;
  const ofTab = matching.filter((member) => inTab(member, query.tab));
  const start = (query.page - 1) * pageSize;
  return { items: ofTab.slice(start, start + pageSize), counts, total: ofTab.length };
}

/** Members newest first; members created at the same instant by descending id, so the order is stable. */
export function newestFirst(members: readonly TeamMember[]): TeamMember[] {
  return members.toSorted((left, right) => {
    const byTime = right.createdAt.getTime() - left.createdAt.getTime();
    if (byTime !== 0) return byTime;
    return BigInt(right.id) > BigInt(left.id) ? 1 : -1;
  });
}
