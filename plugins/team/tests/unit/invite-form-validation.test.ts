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
const OTHER_ROLE_ID = '7000000000000000004';

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

  describe('edit input', () => {
    const initial = validDraft({ storeAccess: 'selected', storeIds: [STORE_ID], commissionConfigIds: [COMMISSION_ID] });

    it('sends only the salary when only the salary changed', () => {
      const input = memberUpdateInputOf(initial, { ...initial, baseSalary: '50000' });

      expect(input).toEqual({ baseSalary: 50_000 });
    });

    it('sends only the roles when only the roles changed', () => {
      const input = memberUpdateInputOf(initial, { ...initial, roleIds: [ROLE_ID, OTHER_ROLE_ID] });

      expect(input).toEqual({ roleIds: [ROLE_ID, OTHER_ROLE_ID] });
    });

    it('sends the store access and its stores together when the stores changed', () => {
      const input = memberUpdateInputOf(initial, { ...initial, storeAccess: 'all' });

      expect(input).toEqual({ storeAccess: 'all', storeIds: [] });
    });

    it('sends only the commissions when only the commissions changed', () => {
      const input = memberUpdateInputOf(initial, { ...initial, commissionConfigIds: [] });

      expect(input).toEqual({ commissionConfigIds: [] });
    });

    it('builds nothing when no term changed, ignoring order and the salary text', () => {
      const reordered = { ...initial, roleIds: [...initial.roleIds], baseSalary: ' 45000 ' };
      const twoRoles = validDraft({ roleIds: [ROLE_ID, OTHER_ROLE_ID] });

      expect(memberUpdateInputOf(initial, reordered)).toBeNull();
      expect(memberUpdateInputOf(twoRoles, { ...twoRoles, roleIds: [OTHER_ROLE_ID, ROLE_ID] })).toBeNull();
    });

    it('builds nothing while the edited draft has gaps', () => {
      expect(memberUpdateInputOf(initial, { ...initial, roleIds: [] })).toBeNull();
      expect(memberUpdateInputOf(initial, { ...initial, baseSalary: 'abc' })).toBeNull();
    });
  });
});
