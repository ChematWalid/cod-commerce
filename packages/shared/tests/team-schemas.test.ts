import { describe, expect, it } from 'vitest';
import {
  acceptInvitationSchema,
  commissionConfigSchema,
  COMMISSION_PERCENT_MAX_BPS,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  inviteMemberSchema,
  listMembersQuerySchema,
  MEMBER_SEARCH_MAX_LENGTH,
  MAX_COMMISSIONS_PER_MEMBER,
  MAX_OPEN_ORDERS_LIMIT,
  MAX_ROLES_PER_GRANT,
  MAX_STORES_PER_GRANT,
  payMemberSchema,
  SALARY_MAX_DZD,
  setLimitSchema,
  TEAM_EMAIL_MAX_LENGTH,
  setReceivingSchema,
  updateMemberSchema,
} from '../src/index';

const ROLE_ID = '1234567890123';
const STORE_ID = '2234567890123';
const validInvite = {
  email: 'agent@shop.test',
  roleIds: [ROLE_ID],
  storeAccess: 'selected',
  storeIds: [STORE_ID],
  baseSalary: 30_000,
};

/** `count` distinct snowflake ids. */
function idsOf(count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => String(1_000_000_000_000n + BigInt(index)));
}

function issueMessagesOf(result: { success: boolean; error?: { issues: { message: string }[] } }): string[] {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('inviteMemberSchema', () => {
  it('parses a valid body and fills the defaults', () => {
    expect(inviteMemberSchema.parse(validInvite)).toEqual({
      ...validInvite,
      commissionConfigIds: [],
      locale: 'ar',
    });
  });

  it('trims and lowercases the email', () => {
    expect(inviteMemberSchema.parse({ ...validInvite, email: ' Foo@X.com ' }).email).toBe('foo@x.com');
  });

  it('drops store ids when the access covers every store', () => {
    expect(inviteMemberSchema.parse({ ...validInvite, storeAccess: 'all' }).storeIds).toEqual([]);
  });

  it.each([
    ['an empty roles list', { roleIds: [] }],
    ['a role id that is not a snowflake', { roleIds: ['abc'] }],
    ['selected access with no store', { storeIds: [] }],
    ['a store id that is not a snowflake', { storeIds: ['0'] }],
    ['an unknown store access', { storeAccess: 'some' }],
    ['a negative salary', { baseSalary: -1 }],
    ['a fractional salary', { baseSalary: 1.5 }],
    ['a salary above the cap', { baseSalary: SALARY_MAX_DZD + 1 }],
    ['a malformed email', { email: 'not an email' }],
    ['an unsupported locale', { locale: 'fr' }],
  ])('rejects %s', (_label, change) => {
    expect(inviteMemberSchema.safeParse({ ...validInvite, ...change }).success).toBe(false);
  });

  it.each([
    ['roleIds', MAX_ROLES_PER_GRANT],
    ['storeIds', MAX_STORES_PER_GRANT],
    ['commissionConfigIds', MAX_COMMISSIONS_PER_MEMBER],
  ])('accepts %s at the cap and refuses one over it with team.invalid-input', (field, cap) => {
    expect(inviteMemberSchema.safeParse({ ...validInvite, [field]: idsOf(cap) }).success).toBe(true);
    const over = inviteMemberSchema.safeParse({ ...validInvite, [field]: idsOf(cap + 1) });
    expect(over.success).toBe(false);
    expect(issueMessagesOf(over)).toEqual(['team.invalid-input']);
  });

  it('collapses repeated ids to one entry', () => {
    const parsed = inviteMemberSchema.parse({
      ...validInvite,
      roleIds: [ROLE_ID, ROLE_ID],
      storeIds: [STORE_ID, STORE_ID],
      commissionConfigIds: [STORE_ID, STORE_ID, STORE_ID],
    });
    expect(parsed).toMatchObject({ roleIds: [ROLE_ID], storeIds: [STORE_ID], commissionConfigIds: [STORE_ID] });
  });

  it('accepts an email at the stored length and refuses one over it with team.invalid-input', () => {
    const domain = '@shop.test';
    const emailOf = (length: number) => `${'a'.repeat(length - domain.length)}${domain}`;
    expect(inviteMemberSchema.safeParse({ ...validInvite, email: emailOf(TEAM_EMAIL_MAX_LENGTH) }).success).toBe(true);
    const over = inviteMemberSchema.safeParse({ ...validInvite, email: emailOf(TEAM_EMAIL_MAX_LENGTH + 1) });
    expect(over.success).toBe(false);
    expect(issueMessagesOf(over)).toEqual(['team.invalid-input']);
  });

  it('accepts the salary bounds', () => {
    expect(inviteMemberSchema.safeParse({ ...validInvite, baseSalary: 0 }).success).toBe(true);
    expect(inviteMemberSchema.safeParse({ ...validInvite, baseSalary: SALARY_MAX_DZD }).success).toBe(true);
  });
});

describe('acceptInvitationSchema', () => {
  const body = { token: 'a'.repeat(43), firstName: ' Amine ', lastName: 'B', password: 'correct-horse' };

  it('trims the names', () => {
    expect(acceptInvitationSchema.parse(body)).toMatchObject({ firstName: 'Amine', lastName: 'B' });
  });

  it.each([
    ['an empty token', { token: '' }],
    ['a blank first name', { firstName: '   ' }],
    ['a blank last name', { lastName: '' }],
    ['a short password', { password: 'short' }],
  ])('rejects %s', (_label, change) => {
    expect(acceptInvitationSchema.safeParse({ ...body, ...change }).success).toBe(false);
  });
});

describe('payMemberSchema', () => {
  it.each([
    ['an empty key', '', false],
    ['a one-character key', 'k', true],
    ['a key at the limit', 'k'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH), true],
    ['a key over the limit', 'k'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1), false],
  ])('%s', (_label, idempotencyKey, ok) => {
    expect(payMemberSchema.safeParse({ idempotencyKey }).success).toBe(ok);
  });
});

describe('updateMemberSchema', () => {
  it('refuses an empty change', () => {
    expect(updateMemberSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a salary-only change', () => {
    expect(updateMemberSchema.parse({ baseSalary: 10 })).toEqual({ baseSalary: 10 });
  });

  it.each([
    ['an empty roles list', { roleIds: [] }],
    ['selected access with no store', { storeAccess: 'selected', storeIds: [] }],
    ['store ids without a store access', { storeIds: [STORE_ID] }],
    ['a negative salary', { baseSalary: -1 }],
    ['too many roles', { roleIds: idsOf(MAX_ROLES_PER_GRANT + 1) }],
    ['too many stores', { storeAccess: 'selected', storeIds: idsOf(MAX_STORES_PER_GRANT + 1) }],
    ['too many commissions', { commissionConfigIds: idsOf(MAX_COMMISSIONS_PER_MEMBER + 1) }],
  ])('rejects %s', (_label, change) => {
    expect(updateMemberSchema.safeParse(change).success).toBe(false);
  });

  it('collapses repeated commission ids to one entry', () => {
    expect(updateMemberSchema.parse({ commissionConfigIds: [ROLE_ID, ROLE_ID] })).toEqual({
      commissionConfigIds: [ROLE_ID],
    });
  });
});

describe('setLimitSchema', () => {
  it.each([
    ['no limit', null, true],
    ['one', 1, true],
    ['the cap', MAX_OPEN_ORDERS_LIMIT, true],
    ['zero', 0, false],
    ['above the cap', MAX_OPEN_ORDERS_LIMIT + 1, false],
    ['a fraction', 2.5, false],
  ])('%s', (_label, maxOpenOrders, ok) => {
    expect(setLimitSchema.safeParse({ maxOpenOrders }).success).toBe(ok);
  });
});

describe('setReceivingSchema', () => {
  it.each([
    ['receiving', true, true],
    ['stopped', false, true],
    ['text', 'false', false],
    ['missing', undefined, false],
    ['null', null, false],
  ])('%s', (_label, receivingOrders, ok) => {
    expect(setReceivingSchema.safeParse({ receivingOrders }).success).toBe(ok);
  });
});

describe('commissionConfigSchema', () => {
  const config = {
    name: ' Confirmations ',
    basis: 'per-confirmed-order',
    valueKind: 'fixed',
    value: 100,
    scope: 'all',
    storeIds: [],
  };

  it('parses a valid config and trims the name', () => {
    expect(commissionConfigSchema.parse(config)).toMatchObject({ name: 'Confirmations', storeIds: [] });
  });

  it.each([
    ['an empty name', { name: '  ' }],
    ['a name over 60 characters', { name: 'n'.repeat(61) }],
    ['an unknown basis', { basis: 'per-call' }],
    ['a zero value', { value: 0 }],
    ['a fractional value', { value: 1.5 }],
    ['a percent above 100%', { valueKind: 'percent', value: COMMISSION_PERCENT_MAX_BPS + 1 }],
    ['selected scope with no store', { scope: 'selected', storeIds: [] }],
    ['too many stores', { scope: 'selected', storeIds: idsOf(MAX_STORES_PER_GRANT + 1) }],
  ])('rejects %s', (_label, change) => {
    expect(commissionConfigSchema.safeParse({ ...config, ...change }).success).toBe(false);
  });

  it('collapses repeated store ids to one entry', () => {
    const selected = { ...config, scope: 'selected', storeIds: [STORE_ID, STORE_ID] };
    expect(commissionConfigSchema.parse(selected).storeIds).toEqual([STORE_ID]);
  });

  it('accepts 100% in basis points', () => {
    const percent = { ...config, valueKind: 'percent', value: COMMISSION_PERCENT_MAX_BPS };
    expect(commissionConfigSchema.safeParse(percent).success).toBe(true);
  });
});

describe('listMembersQuerySchema', () => {
  it('reads the first page of every member when nothing is asked', () => {
    // Act
    const parsed = listMembersQuerySchema.parse({});

    // Assert
    expect(parsed).toEqual({ tab: 'all', page: 1 });
  });

  it('reads a REST query string: the page as text, the search trimmed', () => {
    // Act
    const parsed = listMembersQuerySchema.parse({ tab: 'pending', search: '  Amina ', page: '2' });

    // Assert
    expect(parsed).toEqual({ tab: 'pending', search: 'Amina', page: 2 });
  });

  it('drops a blank search', () => {
    // Act
    const parsed = listMembersQuerySchema.parse({ search: '   ' });

    // Assert
    expect(parsed).toEqual({ tab: 'all', page: 1 });
  });

  it.each([
    ['a null tab', { tab: null }],
    ['a null search', { search: null }],
    ['a null page', { page: null }],
    ['every field null', { tab: null, search: null, page: null }],
    ['an empty page from a REST query string', { page: '' }],
    ['an empty tab from a REST query string', { tab: '' }],
  ])('reads %s as the default first page of every member', (_case, query) => {
    // Act
    const parsed = listMembersQuerySchema.parse(query);

    // Assert
    expect(parsed).toEqual({ tab: 'all', page: 1 });
  });

  it.each([
    ['an unknown tab', { tab: 'removed' }],
    ['page 0', { page: 0 }],
    ['a fractional page', { page: '1.5' }],
    ['a page that is not a number', { page: 'two' }],
    ['a search too long', { search: 'x'.repeat(MEMBER_SEARCH_MAX_LENGTH + 1) }],
  ])('refuses %s', (_case, query) => {
    // Act
    const parsed = listMembersQuerySchema.safeParse(query);

    // Assert
    expect(parsed.success).toBe(false);
  });
});
