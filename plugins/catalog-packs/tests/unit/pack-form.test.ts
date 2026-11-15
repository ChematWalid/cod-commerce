import { CATALOG_PRODUCT_QUERY_KEY, CATALOG_PRODUCTS_QUERY_KEY } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  emptyPackForm,
  PACK_SAVE_INVALIDATES,
  type PackForm,
  packFieldDisabled,
  packFormErrors,
  packFormOf,
  packInputOf,
  TOO_FEW_COMPONENTS_MESSAGE_ID,
} from '../../dashboard/model/pack-form';

const twoComponents: PackForm = {
  ...emptyPackForm(),
  discountType: 'percent',
  discountValue: '10',
  components: [
    { productId: '11', title: 'Shirt', variantId: null, quantity: 1 },
    { productId: '12', title: 'Cap', variantId: '1201', quantity: 2 },
  ],
};

describe('pack form', () => {
  it('builds input from form state', () => {
    // Act
    const input = packInputOf(twoComponents);

    // Assert
    expect(input).toEqual({
      packPricingMode: 'components_sum',
      packFixedPrice: null,
      packDiscountType: 'percent',
      packDiscountValue: 10,
      packVariantMode: 'per_component',
      packSharedOption: null,
      packWeightMode: 'components_sum',
      packFixedWeightGrams: null,
      components: [
        { productId: '11', variantId: null, quantity: 1 },
        { productId: '12', variantId: '1201', quantity: 2 },
      ],
    });
  });

  it('sends a fixed price and weight without a discount, and the shared option without pinned variants', () => {
    // Arrange
    const form: PackForm = {
      ...twoComponents,
      pricingMode: 'fixed',
      fixedPrice: '4000',
      weightMode: 'fixed',
      fixedWeight: '900',
      variantMode: 'shared_option',
      sharedOption: ' Size ',
    };

    // Act
    const input = packInputOf(form);

    // Assert
    expect(input).toMatchObject({
      packFixedPrice: 4000,
      packDiscountType: null,
      packDiscountValue: null,
      packFixedWeightGrams: 900,
      packSharedOption: 'Size',
      components: [
        { productId: '11', variantId: null, quantity: 1 },
        { productId: '12', variantId: null, quantity: 2 },
      ],
    });
  });

  it('flags fewer than 2 components', () => {
    // Arrange
    const form = { ...twoComponents, components: twoComponents.components.slice(0, 1) };

    // Act
    const errors = packFormErrors(form);

    // Assert
    expect(errors.components).toBe(TOO_FEW_COMPONENTS_MESSAGE_ID);
    expect(packFormErrors(twoComponents)).toEqual({});
  });

  it('flags a missing fixed price and a missing shared option', () => {
    // Arrange
    const form: PackForm = { ...twoComponents, pricingMode: 'fixed', variantMode: 'shared_option' };

    // Act
    const errors = packFormErrors(form);

    // Assert
    expect(Object.keys(errors).sort()).toEqual(['fixedPrice', 'sharedOption']);
  });

  it('disables discount fields in fixed mode', () => {
    // Arrange
    const fixed: PackForm = { ...twoComponents, pricingMode: 'fixed' };

    // Act and Assert
    expect(packFieldDisabled(fixed, 'discountType', false)).toBe(true);
    expect(packFieldDisabled(fixed, 'discountValue', false)).toBe(true);
    expect(packFieldDisabled(fixed, 'fixedPrice', false)).toBe(false);
    expect(packFieldDisabled(twoComponents, 'discountValue', false)).toBe(false);
    expect(packFieldDisabled(twoComponents, 'fixedPrice', false)).toBe(true);
    expect(packFieldDisabled(twoComponents, 'discountValue', true)).toBe(true);
  });

  it('lists the shared `@cod/shared` product query keys to invalidate after save', () => {
    // Assert
    expect(PACK_SAVE_INVALIDATES).toEqual([CATALOG_PRODUCT_QUERY_KEY, CATALOG_PRODUCTS_QUERY_KEY]);
  });

  it('reads a stored pack back into the form, titles from the products it knows', () => {
    // Arrange
    const stored = {
      packPricingMode: 'fixed' as const,
      packFixedPrice: 4000,
      packDiscountType: null,
      packDiscountValue: null,
      packVariantMode: 'per_component' as const,
      packSharedOption: null,
      packWeightMode: 'components_sum' as const,
      packFixedWeightGrams: null,
      components: [
        { productId: '11', variantId: null, quantity: 1 },
        { productId: '12', variantId: null, quantity: 3 },
      ],
    };

    // Act
    const form = packFormOf(stored, new Map([['11', 'Shirt']]));

    // Assert
    expect(form.fixedPrice).toBe('4000');
    expect(form.components).toEqual([
      { productId: '11', title: 'Shirt', variantId: null, quantity: 1 },
      { productId: '12', title: '12', variantId: null, quantity: 3 },
    ]);
    expect(packInputOf(form)).toEqual(stored);
  });
});
