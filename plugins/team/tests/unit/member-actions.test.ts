import { MAX_OPEN_ORDERS_LIMIT, toSnowflake } from '@cod/shared';
import { InvalidInputError, OwnerProtectedError } from '../../domain/errors';
import { describe, expect, it } from 'vitest';
import {
  assertMaxOpenOrders,
  assertNotOwner,
  changedFieldsOf,
  clearingGrantOf,
  editedGrantOf,
  touchesAccess,
  touchesPay,
} from '../../domain/member-actions';
import type { MemberGrant } from '../../domain/member-grant';

const S1 = toSnowflake('11');
const S2 = toSnowflake('12');
const ROLE = toSnowflake('901');
const OTHER_ROLE = toSnowflake('902');
const held: MemberGrant = { roleIds: [ROLE], storeAccess: 'selected', storeIds: [S1] };

describe('assertNotOwner', () => {
  it('refuses the business owner and lets any other member through', () => {
    expect(() => {
      assertNotOwner({ administratorId: 1 }, 1);
    }).toThrow(OwnerProtectedError);
    expect(() => {
      assertNotOwner({ administratorId: 2 }, 1);
    }).not.toThrow();
    expect(() => {
      assertNotOwner({ administratorId: null }, null);
    }).not.toThrow();
  });
});

describe('assertMaxOpenOrders', () => {
  it.each([
    ['zero', 0],
    ['a negative', -3],
    ['a fraction', 1.5],
    ['above the cap', MAX_OPEN_ORDERS_LIMIT + 1],
  ])('refuses %s', (_label, value) => {
    expect(() => {
      assertMaxOpenOrders(value);
    }).toThrow(InvalidInputError);
  });

  it.each([
    ['no limit', null],
    ['one', 1],
    ['the cap', MAX_OPEN_ORDERS_LIMIT],
  ])('accepts %s', (_label, value) => {
    expect(() => {
      assertMaxOpenOrders(value);
    }).not.toThrow();
  });
});

describe('clearingGrantOf', () => {
  it('names all stores for an all-store actor and the member own stores for a store-limited one', () => {
    expect(clearingGrantOf(held, true)).toEqual({ roleIds: [], storeAccess: 'all', storeIds: [] });
    expect(clearingGrantOf(held, false)).toEqual({ roleIds: [], storeAccess: 'selected', storeIds: [S1] });
  });
});

describe('editedGrantOf', () => {
  it('keeps what the edit does not name and drops store ids for all-store access', () => {
    expect(editedGrantOf(held, { roleIds: [OTHER_ROLE] })).toEqual({ ...held, roleIds: [OTHER_ROLE] });
    expect(editedGrantOf(held, { storeAccess: 'selected', storeIds: [S2] })).toEqual({ ...held, storeIds: [S2] });
    expect(editedGrantOf(held, { storeAccess: 'all' })).toEqual({ roleIds: [ROLE], storeAccess: 'all', storeIds: [] });
  });
});

describe('what an edit touches', () => {
  it('tells access from pay and lists the named fields only, never a value (D216)', () => {
    const edit = { roleIds: [ROLE], baseSalary: 40_000 };

    expect(touchesAccess(edit)).toBe(true);
    expect(touchesPay(edit)).toBe(true);
    expect(touchesAccess({ baseSalary: 1 })).toBe(false);
    expect(touchesPay({ storeAccess: 'all' })).toBe(false);
    expect(changedFieldsOf(edit)).toEqual(['roles', 'baseSalary']);
    expect(changedFieldsOf({ storeAccess: 'selected', storeIds: [S1], commissionConfigIds: [] })).toEqual([
      'storeAccess',
      'storeIds',
      'commissionConfigIds',
    ]);
  });
});
