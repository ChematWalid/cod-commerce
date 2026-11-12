import { describe, expect, it } from 'vitest';
import {
  acceptInvitationSchema,
  commissionConfigSchema,
  COMMISSION_PERCENT_MAX_BPS,
  IDEMPOTENCY_KEY_MAX_LENGTH,
  inviteMemberSchema,
  MAX_OPEN_ORDERS_LIMIT,
  payMemberSchema,
  SALARY_MAX_DZD,
  setLimitSchema,
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
  ])('rejects %s', (_label, change) => {
    expect(updateMemberSchema.safeParse(change).success).toBe(false);
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
  ])('rejects %s', (_label, change) => {
    expect(commissionConfigSchema.safeParse({ ...config, ...change }).success).toBe(false);
  });

  it('accepts 100% in basis points', () => {
    const percent = { ...config, valueKind: 'percent', value: COMMISSION_PERCENT_MAX_BPS };
    expect(commissionConfigSchema.safeParse(percent).success).toBe(true);
  });
});
