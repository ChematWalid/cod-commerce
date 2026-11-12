import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_ACTIONS,
  ALL_STORES_ONLY_ACTIVITY_ACTIONS,
  isAllStoresOnlyActivityAction,
  teamCommissionActivityDiffSchema,
  teamMemberActivityDiffSchema,
} from '../src/index';

const MEMBER_ID = '7300000000000000001';
const COMMISSION_ID = '7300000000000000002';

describe('team member activity diff (D216)', () => {
  it('accepts the member id, a display name and the names of the changed fields', () => {
    // Arrange
    const diff = { memberId: MEMBER_ID, displayName: 'Amina B.', changedFields: ['roles', 'baseSalary'] };

    // Act
    const result = teamMemberActivityDiffSchema.safeParse(diff);

    // Assert
    expect(result.success).toBe(true);
  });

  it('accepts an invited member that has no display name yet', () => {
    const result = teamMemberActivityDiffSchema.safeParse({ memberId: MEMBER_ID, displayName: null, changedFields: [] });

    expect(result.success).toBe(true);
  });

  it.each([
    ['baseSalary', 45_000],
    ['amount', 45_000],
    ['commissionValue', 500],
    ['value', 500],
    ['email', 'amina@example.test'],
    ['token', 'raw'],
    ['tokenHash', 'abc'],
  ])('refuses a diff that carries %s', (key, value) => {
    // Arrange
    const diff = { memberId: MEMBER_ID, displayName: 'Amina B.', changedFields: [], [key]: value };

    // Act
    const result = teamMemberActivityDiffSchema.safeParse(diff);

    // Assert
    expect(result.success).toBe(false);
  });

  it('refuses a changed-field entry that is not a known field name', () => {
    const result = teamMemberActivityDiffSchema.safeParse({
      memberId: MEMBER_ID,
      displayName: 'Amina B.',
      changedFields: ['45000'],
    });

    expect(result.success).toBe(false);
  });

  it('refuses an email used as the display name', () => {
    const result = teamMemberActivityDiffSchema.safeParse({
      memberId: MEMBER_ID,
      displayName: 'amina@example.test',
      changedFields: [],
    });

    expect(result.success).toBe(false);
  });
});

describe('team commission activity diff (D216)', () => {
  it('accepts the config id, its name and the names of the changed fields', () => {
    const result = teamCommissionActivityDiffSchema.safeParse({
      commissionConfigId: COMMISSION_ID,
      name: 'Confirmers',
      changedFields: ['value', 'basis'],
    });

    expect(result.success).toBe(true);
  });

  it('refuses a commission diff that carries the value', () => {
    const result = teamCommissionActivityDiffSchema.safeParse({
      commissionConfigId: COMMISSION_ID,
      name: 'Confirmers',
      changedFields: ['value'],
      value: 500,
    });

    expect(result.success).toBe(false);
  });
});

describe('activity rows only all-store viewers see (D217)', () => {
  it('holds every team action and no rbac action', () => {
    // Arrange
    const teamActions = Object.values(ACTIVITY_ACTIONS).filter((action) => action.startsWith('team.'));

    // Act
    const restricted = [...ALL_STORES_ONLY_ACTIVITY_ACTIONS];

    // Assert
    expect(restricted.sort()).toEqual([...teamActions].sort());
  });

  it('answers per action', () => {
    expect(isAllStoresOnlyActivityAction(ACTIVITY_ACTIONS.SALARY_PAID)).toBe(true);
    expect(isAllStoresOnlyActivityAction(ACTIVITY_ACTIONS.ROLE_CREATED)).toBe(false);
    expect(isAllStoresOnlyActivityAction('unknown.action')).toBe(false);
  });
});
