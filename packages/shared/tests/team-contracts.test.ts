import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_ACTIONS,
  DOMAIN_EVENT_NAMES,
  INVITATION_RESEND_COOLDOWN_MS,
  INVITATION_TTL_MS,
  MEMBER_STATUSES,
  MEMBER_TABS,
  TEAM_ERROR_CODES,
} from '../src/index';

const DAY_MS = 24 * 3600 * 1000;

describe('team contracts', () => {
  it('keeps an invitation open for seven days and a resend one minute apart', () => {
    expect(INVITATION_TTL_MS).toBe(7 * DAY_MS);
    expect(INVITATION_RESEND_COOLDOWN_MS).toBe(60_000);
  });

  it('lists the member statuses and the list tabs', () => {
    expect(MEMBER_STATUSES).toEqual(['invited', 'active', 'inactive']);
    expect(MEMBER_TABS).toEqual(['all', 'active', 'pending', 'inactive']);
  });

  it('prefixes every team error code with team. and never reuses one', () => {
    const codes = Object.values(TEAM_ERROR_CODES);
    expect(codes.every((code) => /^team\.[a-z-]+$/.test(code))).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('logs team activity under team. actions', () => {
    const teamActions = Object.values(ACTIVITY_ACTIONS).filter((action) => action.startsWith('team.'));
    expect(teamActions).toHaveLength(12);
    expect(ACTIVITY_ACTIONS.MEMBER_INVITED).toBe('team.member.invited');
  });

  it('names the salary payment event', () => {
    expect(DOMAIN_EVENT_NAMES.SalaryPaid).toBe('salary.paid');
  });
});
