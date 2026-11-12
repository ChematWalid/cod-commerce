import { describe, expect, it } from 'vitest';
import {
  emptyInviteDraft,
  type InviteDraft,
  inviteErrorsOf,
  inviteInputOf,
  memberUpdateInputOf,
} from '../../dashboard/invite-form-validation';

const ROLE_ID = '7000000000000000001';
const STORE_ID = '7000000000000000002';
const COMMISSION_ID = '7000000000000000003';

const validDraft = (patch: Partial<InviteDraft> = {}): InviteDraft => ({
  ...emptyInviteDraft(),
  email: ' Agent@Example.TEST ',
  roleIds: [ROLE_ID],
  baseSalary: '45000',
  ...patch,
});

describe('invite form validation', () => {
  it('accepts a complete draft and builds the invite input with a whole-DZD salary', () => {
    const draft = validDraft({ commissionConfigIds: [COMMISSION_ID] });

    const errors = inviteErrorsOf(draft);
    const input = inviteInputOf(draft, 'en');

    expect(errors).toEqual({});
    expect(input).toEqual({
      email: 'agent@example.test',
      roleIds: [ROLE_ID],
      storeAccess: 'all',
      storeIds: [],
      baseSalary: 45_000,
      commissionConfigIds: [COMMISSION_ID],
      locale: 'en',
    });
  });

  it('refuses a draft with no role', () => {
    const errors = inviteErrorsOf(validDraft({ roleIds: [] }));

    expect(errors).toEqual({ roleIds: 'team.invite-error-roles' });
  });

  it('refuses "only these stores" with no store chosen', () => {
    const errors = inviteErrorsOf(validDraft({ storeAccess: 'selected', storeIds: [] }));

    expect(errors).toEqual({ storeIds: 'team.invite-error-stores' });
  });

  it('keeps the chosen stores for "only these stores" and drops them for all stores', () => {
    const selected = inviteInputOf(validDraft({ storeAccess: 'selected', storeIds: [STORE_ID] }), 'ar');
    const all = inviteInputOf(validDraft({ storeAccess: 'all', storeIds: [STORE_ID] }), 'ar');

    expect(selected?.storeIds).toEqual([STORE_ID]);
    expect(all?.storeIds).toEqual([]);
  });

  it.each([
    ['empty', ''],
    ['blank', '   '],
    ['negative', '-1'],
    ['fractional', '12.5'],
    ['not a number', 'abc'],
    ['above the cap', '100000001'],
  ])('refuses an %s salary', (_case, baseSalary) => {
    const errors = inviteErrorsOf(validDraft({ baseSalary }));

    expect(errors).toEqual({ baseSalary: 'team.invite-error-salary' });
  });

  it('accepts a zero salary', () => {
    expect(inviteErrorsOf(validDraft({ baseSalary: '0' }))).toEqual({});
  });

  it('refuses a malformed email', () => {
    const errors = inviteErrorsOf(validDraft({ email: 'not-an-email' }));

    expect(errors).toEqual({ email: 'team.invite-error-email' });
  });

  it('reports every gap of an empty draft and builds no input', () => {
    const draft = emptyInviteDraft();

    expect(Object.keys(inviteErrorsOf(draft)).sort()).toEqual(['baseSalary', 'email', 'roleIds']);
    expect(inviteInputOf(draft, 'en')).toBeNull();
  });

  it('builds an edit input without the email, from the same rules', () => {
    const draft = validDraft({ storeAccess: 'selected', storeIds: [STORE_ID] });

    expect(memberUpdateInputOf(draft)).toEqual({
      roleIds: [ROLE_ID],
      storeAccess: 'selected',
      storeIds: [STORE_ID],
      baseSalary: 45_000,
      commissionConfigIds: [],
    });
    expect(memberUpdateInputOf({ ...draft, roleIds: [] })).toBeNull();
  });
});
