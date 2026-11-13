import { describe, expect, it } from 'vitest';
import { updateCommissionConfigSchema } from '../src/index';

const STORE_ID = '2234567890123';

describe('updateCommissionConfigSchema', () => {
  it('reads a rename alone, trimmed', () => {
    // Act
    const parsed = updateCommissionConfigSchema.parse({ name: '  Delivered bonus ' });

    // Assert
    expect(parsed).toEqual({ name: 'Delivered bonus' });
  });

  it('drops the stores of an all scope and keeps those of a selected one', () => {
    // Act
    const all = updateCommissionConfigSchema.parse({ scope: 'all', storeIds: [STORE_ID] });
    const selected = updateCommissionConfigSchema.parse({ scope: 'selected', storeIds: [STORE_ID, STORE_ID] });

    // Assert
    expect(all).toEqual({ scope: 'all', storeIds: [] });
    expect(selected).toEqual({ scope: 'selected', storeIds: [STORE_ID] });
  });

  it.each([
    ['no change at all', {}],
    ['an empty name', { name: '  ' }],
    ['an unknown basis', { basis: 'per-call' }],
    ['an unknown value kind', { valueKind: 'share' }],
    ['a zero value', { value: 0 }],
    ['a fractional value', { value: 2.5 }],
    ['stores without a scope', { storeIds: [STORE_ID] }],
    ['a selected scope with no store', { scope: 'selected', storeIds: [] }],
  ])('refuses %s', (_case, patch) => {
    // Act
    const parsed = updateCommissionConfigSchema.safeParse(patch);

    // Assert
    expect(parsed.success).toBe(false);
  });
});
