import { describe, expect, it } from 'vitest';
import { acceptInputOf } from '../../dashboard/accept-form';
import { commissionInputOf, type CommissionDraft, emptyCommissionDraft } from '../../dashboard/commission-draft';
import { orderLimitOf } from '../../dashboard/order-limit';

const draft = (patch: Partial<CommissionDraft>): CommissionDraft => ({
  ...emptyCommissionDraft(),
  name: 'Per confirmed',
  ...patch,
});

describe('order limit field', () => {
  it('reads an empty field as no limit', () => {
    expect(orderLimitOf('  ')).toEqual({ valid: true, maxOpenOrders: null });
  });

  it('reads a whole number from 1 up to the cap', () => {
    expect(orderLimitOf('25')).toEqual({ valid: true, maxOpenOrders: 25 });
    expect(orderLimitOf('10000')).toEqual({ valid: true, maxOpenOrders: 10_000 });
  });

  it.each(['0', '-3', '2.5', 'ten', '10001'])('refuses %s', (text) => {
    expect(orderLimitOf(text)).toEqual({ valid: false });
  });
});

describe('inline commission draft', () => {
  it('sends a fixed commission in whole DZD for every store', () => {
    expect(commissionInputOf(draft({ valueKind: 'fixed', value: '150' }))).toEqual({
      name: 'Per confirmed',
      basis: 'per-confirmed-order',
      valueKind: 'fixed',
      value: 150,
      scope: 'all',
    });
  });

  it('sends a percent in basis points', () => {
    expect(commissionInputOf(draft({ valueKind: 'percent', value: '2.5' }))?.value).toBe(250);
    expect(commissionInputOf(draft({ valueKind: 'percent', value: '100' }))?.value).toBe(10_000);
  });

  it.each([
    ['an empty name', { name: '  ' }],
    ['a zero value', { value: '0' }],
    ['a fractional fixed value', { valueKind: 'fixed' as const, value: '1.5' }],
    ['a percent above 100', { valueKind: 'percent' as const, value: '100.01' }],
    ['a percent with three decimals', { valueKind: 'percent' as const, value: '1.234' }],
  ])('refuses %s', (_case, patch) => {
    expect(commissionInputOf(draft({ value: '10', ...patch }))).toBeNull();
  });
});

describe('accept form', () => {
  const filled = { firstName: ' Amina ', lastName: 'Saadi', password: 'a long passphrase' };

  it('builds the accept body with trimmed names and the token of the link', () => {
    expect(acceptInputOf('tok', filled)).toEqual({
      token: 'tok',
      firstName: 'Amina',
      lastName: 'Saadi',
      password: 'a long passphrase',
    });
  });

  it.each([
    ['no first name', { firstName: '  ' }],
    ['no last name', { lastName: '' }],
    ['a short password', { password: 'short' }],
  ])('refuses %s', (_case, patch) => {
    expect(acceptInputOf('tok', { ...filled, ...patch })).toBeNull();
  });
});
