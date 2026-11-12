import { describe, expect, it } from 'vitest';
import type { TeamMemberDto } from '../../dashboard/dto';
import {
  canInvite,
  canPaySalary,
  columnsFor,
  displayNameOf,
  menuActionsOf,
  statusOf,
  storeAccessOf,
  tabsOf,
} from '../../dashboard/member-view-model';

const VIEW = 'team.members.view';
const INVITE = 'team.members.invite';
const EDIT = 'team.members.edit';
const REMOVE = 'team.members.remove';
const VIEW_ROLES = 'team.roles.view';
const EVERY_KEY: ReadonlySet<string> = new Set([VIEW, INVITE, EDIT, REMOVE, VIEW_ROLES]);

const member = (patch: Partial<TeamMemberDto> = {}): TeamMemberDto => ({
  id: '7000000000000000010',
  administratorId: '12',
  email: 'agent@example.test',
  name: 'Amina Saadi',
  status: 'active',
  tab: 'active',
  invitationExpired: false,
  roles: [{ id: '7000000000000000001', name: 'Order Manager' }],
  storeAccess: 'all',
  storeIds: [],
  storeNames: [],
  commissionConfigIds: [],
  baseSalary: 45_000,
  ordersCount: 0,
  maxOpenOrders: null,
  receivingOrders: true,
  invitedAt: null,
  joinedAt: '2026-11-01T10:00:00.000Z',
  ...patch,
});

describe('member view model', () => {
  it('shows the four tabs in order with the counts the server gave', () => {
    const tabs = tabsOf({ all: 6, active: 3, pending: 2, inactive: 1 });

    expect(tabs).toEqual([
      { tab: 'all', labelId: 'team.tab-all', count: 6 },
      { tab: 'active', labelId: 'team.tab-active', count: 3 },
      { tab: 'pending', labelId: 'team.tab-pending', count: 2 },
      { tab: 'inactive', labelId: 'team.tab-inactive', count: 1 },
    ]);
  });

  it.each([
    [{ status: 'active' as const }, 'team.status-active', 'active'],
    [{ status: 'invited' as const, tab: 'pending' as const }, 'team.status-pending', 'pending'],
    [
      { status: 'invited' as const, tab: 'pending' as const, invitationExpired: true },
      'team.status-expired',
      'expired',
    ],
    [{ status: 'inactive' as const, tab: 'inactive' as const }, 'team.status-inactive', 'inactive'],
  ])('labels %o as %s', (patch, labelId, tone) => {
    expect(statusOf(member(patch))).toEqual({ labelId, tone });
  });

  it('shows the salary column only to a holder of team.members.edit (D207)', () => {
    const withEdit = columnsFor(EVERY_KEY);
    const viewOnly = columnsFor(new Set([VIEW]));

    expect(withEdit).toEqual(['employee', 'roles', 'salary', 'status', 'orders', 'stores', 'joined', 'actions']);
    expect(viewOnly).not.toContain('salary');
    expect(viewOnly).toHaveLength(withEdit.length - 1);
  });

  it('offers an active member every action of an editor and remover', () => {
    const actions = menuActionsOf(member(), EVERY_KEY);

    expect(actions).toEqual(['view', 'edit', 'set-limit', 'stop-receiving', 'deactivate', 'remove']);
    expect(canPaySalary(member(), EVERY_KEY)).toBe(true);
  });

  it('offers resume instead of stop for a member not receiving orders', () => {
    const actions = menuActionsOf(member({ receivingOrders: false }), EVERY_KEY);

    expect(actions).toContain('resume-receiving');
    expect(actions).not.toContain('stop-receiving');
  });

  it('offers a pending member only resend and revoke, and no pay', () => {
    const pending = member({ status: 'invited', tab: 'pending', administratorId: null, joinedAt: null });

    expect(menuActionsOf(pending, EVERY_KEY)).toEqual(['view', 'resend', 'revoke']);
    expect(canPaySalary(pending, EVERY_KEY)).toBe(false);
  });

  it('offers an inactive member reactivate and remove, and no pay', () => {
    const inactive = member({ status: 'inactive', tab: 'inactive' });

    expect(menuActionsOf(inactive, EVERY_KEY)).toEqual(['view', 'reactivate', 'remove']);
    expect(canPaySalary(inactive, EVERY_KEY)).toBe(false);
  });

  it('offers a viewer nothing but the details', () => {
    const viewer: ReadonlySet<string> = new Set([VIEW]);

    expect(menuActionsOf(member(), viewer)).toEqual(['view']);
    expect(menuActionsOf(member({ status: 'invited', tab: 'pending' }), viewer)).toEqual(['view']);
    expect(canPaySalary(member(), viewer)).toBe(false);
  });

  it('offers no Edit to an editor who cannot read the roles, since the dialog needs them', () => {
    const editor: ReadonlySet<string> = new Set([VIEW, EDIT]);

    expect(menuActionsOf(member(), editor)).toEqual(['view', 'set-limit', 'stop-receiving', 'deactivate']);
    expect(menuActionsOf(member(), new Set([VIEW, EDIT, VIEW_ROLES]))).toContain('edit');
  });

  it('offers Invite only to an inviter who can read the roles, and resend and revoke without them', () => {
    const inviter: ReadonlySet<string> = new Set([VIEW, INVITE]);

    expect(canInvite(inviter)).toBe(false);
    expect(canInvite(new Set([INVITE, VIEW_ROLES]))).toBe(true);
    expect(canInvite(new Set([VIEW_ROLES]))).toBe(false);
    expect(menuActionsOf(member({ status: 'invited', tab: 'pending' }), inviter)).toEqual(['view', 'resend', 'revoke']);
  });

  it('names a member by name, or by address when the invitee has none yet', () => {
    expect(displayNameOf(member())).toBe('Amina Saadi');
    expect(displayNameOf(member({ name: null }))).toBe('agent@example.test');
  });

  it('describes the store access as all stores or the store names', () => {
    expect(storeAccessOf(member())).toEqual({ kind: 'all' });
    expect(storeAccessOf(member({ storeAccess: 'selected', storeNames: ['Alger', 'Oran'] }))).toEqual({
      kind: 'stores',
      names: ['Alger', 'Oran'],
    });
  });
});
