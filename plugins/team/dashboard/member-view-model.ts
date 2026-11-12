import { MEMBER_TABS, type MemberTab } from '@cod/shared';
import { EDIT_MEMBERS_KEY, INVITE_MEMBERS_KEY, REMOVE_MEMBERS_KEY, VIEW_ROLES_KEY } from './constants';
import type { TeamMemberCountsDto, TeamMemberDto } from './dto';

/** One tab of the members list and its count under the current search. */
export interface TabView {
  readonly tab: MemberTab;
  readonly labelId: string;
  readonly count: number;
}

/** How a status badge reads: its message and its tone, which picks the badge style. */
export interface StatusView {
  readonly labelId: string;
  readonly tone: 'active' | 'pending' | 'expired' | 'inactive';
}

export const MEMBER_COLUMNS = [
  'employee',
  'roles',
  'salary',
  'status',
  'orders',
  'stores',
  'joined',
  'actions',
] as const;
export type MemberColumn = (typeof MEMBER_COLUMNS)[number];

/** What a row's menu can do; pay salary is the row's own button. */
export type MemberAction =
  | 'view'
  | 'edit'
  | 'set-limit'
  | 'stop-receiving'
  | 'resume-receiving'
  | 'resend'
  | 'revoke'
  | 'deactivate'
  | 'reactivate'
  | 'remove';

export const TAB_LABEL_IDS: Readonly<Record<MemberTab, string>> = {
  all: 'team.tab-all',
  active: 'team.tab-active',
  pending: 'team.tab-pending',
  inactive: 'team.tab-inactive',
};

export const COLUMN_LABEL_IDS: Readonly<Record<MemberColumn, string>> = {
  employee: 'team.column-employee',
  roles: 'team.column-roles',
  salary: 'team.column-salary',
  status: 'team.column-status',
  orders: 'team.column-orders',
  stores: 'team.column-stores',
  joined: 'team.column-joined',
  actions: 'team.column-actions',
};

export const ACTION_LABEL_IDS: Readonly<Record<MemberAction, string>> = {
  view: 'team.action-view',
  edit: 'team.action-edit',
  'set-limit': 'team.action-set-limit',
  'stop-receiving': 'team.action-stop-receiving',
  'resume-receiving': 'team.action-resume-receiving',
  resend: 'team.action-resend',
  revoke: 'team.action-revoke',
  deactivate: 'team.action-deactivate',
  reactivate: 'team.action-reactivate',
  remove: 'team.action-remove',
};

/** The tabs in their fixed order (All, Active, Pending, Inactive) with the server's counts. */
export function tabsOf(counts: TeamMemberCountsDto): TabView[] {
  return MEMBER_TABS.map((tab) => ({ tab, labelId: TAB_LABEL_IDS[tab], count: counts[tab] }));
}

/** A pending member whose link ran out reads "Expired", so it is resent or revoked rather than waited on. */
export function statusOf(member: TeamMemberDto): StatusView {
  if (member.status === 'active') return { labelId: 'team.status-active', tone: 'active' };
  if (member.status === 'inactive') return { labelId: 'team.status-inactive', tone: 'inactive' };
  if (member.invitationExpired) return { labelId: 'team.status-expired', tone: 'expired' };
  return { labelId: 'team.status-pending', tone: 'pending' };
}

/** The table's columns; the salary only for a holder of `team.members.edit` (D207). */
export function columnsFor(held: ReadonlySet<string>): MemberColumn[] {
  return MEMBER_COLUMNS.filter((column) => column !== 'salary' || held.has(EDIT_MEMBERS_KEY));
}

/**
 * The invite and edit dialogs list the business roles, which rbac answers only to a holder of `team.roles.view`; the
 * catalogue does not tie that key to `team.members.invite`/`edit`, so a caller without it would get a dialog it can
 * never submit.
 */
const readsRoles = (held: ReadonlySet<string>): boolean => held.has(VIEW_ROLES_KEY);

/** The Invite button: `team.members.invite` plus `team.roles.view` for the dialog's role list. */
export function canInvite(held: ReadonlySet<string>): boolean {
  return held.has(INVITE_MEMBERS_KEY) && readsRoles(held);
}

function editActionsOf(member: TeamMemberDto, held: ReadonlySet<string>): MemberAction[] {
  if (member.status === 'inactive') return ['reactivate'];
  if (member.status !== 'active') return [];
  const receiving: MemberAction = member.receivingOrders ? 'stop-receiving' : 'resume-receiving';
  const edit: MemberAction[] = readsRoles(held) ? ['edit'] : [];
  return [...edit, 'set-limit', receiving, 'deactivate'];
}

/**
 * The menu of a row, from what the caller holds and the member's status. A pending member is resent or revoked
 * (`team.members.invite`); an account is changed with `team.members.edit` (Edit also needs `team.roles.view`) and
 * removed with `team.members.remove`.
 * The server checks every action again, including reach and the owner rules.
 */
export function menuActionsOf(member: TeamMemberDto, held: ReadonlySet<string>): MemberAction[] {
  const actions: MemberAction[] = ['view'];
  if (member.status === 'invited') {
    return held.has(INVITE_MEMBERS_KEY) ? [...actions, 'resend', 'revoke'] : actions;
  }
  if (held.has(EDIT_MEMBERS_KEY)) actions.push(...editActionsOf(member, held));
  if (held.has(REMOVE_MEMBERS_KEY)) actions.push('remove');
  return actions;
}

/** Pay salary is offered on an active member to a holder of `team.members.edit` (D207). */
export function canPaySalary(member: TeamMemberDto, held: ReadonlySet<string>): boolean {
  return member.status === 'active' && held.has(EDIT_MEMBERS_KEY);
}

/** The member's name, or the address an invitee was invited at until it gives one. */
export function displayNameOf(member: Pick<TeamMemberDto, 'name' | 'email'>): string {
  return member.name ?? member.email;
}

export type StoreAccessView = { readonly kind: 'all' } | { readonly kind: 'stores'; readonly names: readonly string[] };

export function storeAccessOf(member: TeamMemberDto): StoreAccessView {
  return member.storeAccess === 'all' ? { kind: 'all' } : { kind: 'stores', names: member.storeNames };
}
