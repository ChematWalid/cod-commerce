import { describe, expect, it } from 'vitest';
import { productInputSchema, productPatchSchema, productSettingsPatchSchema } from '../../src/index';

const validProduct = { title: 'Red shoe', status: 'active', type: 'physical', price: 2500 };

describe('productPatchSchema settings', () => {
  it('leaves the order managers and custom attributes unchanged when a patch omits them', () => {
    const parsed = productPatchSchema.parse({ settings: { soldOut: true } });

    expect(parsed.settings).toEqual({ soldOut: true });
  });

  it('changes one quantity rule without resending the others', () => {
    const parsed = productPatchSchema.parse({ settings: { quantityRules: { step: 2 } } });

    expect(parsed.settings).toEqual({ quantityRules: { step: 2 } });
  });

  it('clears a list only when the patch sends it empty', () => {
    expect(productSettingsPatchSchema.parse({ orderManagerIds: [] })).toEqual({ orderManagerIds: [] });
  });

  it('still refuses a quantity step of 0 in a patch', () => {
    expect(productPatchSchema.safeParse({ settings: { quantityRules: { step: 0 } } }).success).toBe(false);
  });
});

describe('repeated ids and names', () => {
  it('refuses the same variant patched twice', () => {
    const variants = [
      { id: '1', price: 1 },
      { id: '1', price: 2 },
    ];

    expect(productPatchSchema.safeParse({ variants }).success).toBe(false);
  });

  it('refuses the same variant written with and without leading zeros', () => {
    expect(productPatchSchema.safeParse({ variants: [{ id: '01' }, { id: 1 }] }).success).toBe(false);
  });

  it('refuses one link id written with and without leading zeros', () => {
    expect(productInputSchema.safeParse({ ...validProduct, tagIds: ['01', '1'] }).success).toBe(false);
  });

  it('refuses two custom attributes with the same name whatever its case', () => {
    const customAttributes = [
      { name: 'Material', value: 'Leather' },
      { name: 'material', value: 'Cotton' },
    ];

    expect(productPatchSchema.safeParse({ settings: { customAttributes } }).success).toBe(false);
  });
});

describe('catalogRefIdSchema numbers', () => {
  it('refuses a numeric id that is not a safe integer, whose digits are already lost', () => {
    expect(productInputSchema.safeParse({ ...validProduct, brandId: Number.MAX_SAFE_INTEGER + 2 }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...validProduct, brandId: 1.5 }).success).toBe(false);
    expect(productInputSchema.parse({ ...validProduct, brandId: 7 }).brandId).toBe('7');
  });
});
