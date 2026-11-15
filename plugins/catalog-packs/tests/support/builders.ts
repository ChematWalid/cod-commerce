import { toSnowflake } from '@cod/shared';
import type { ComponentProduct } from '../../domain/component-product';
import type { PackDefinition, PackRecord } from '../../domain/pack';

/** A per-component, summed, 10 % pack of products 11 (×1) and 12 (×1), weights summed. */
export function aDefinition(overrides: Partial<PackDefinition> = {}): PackDefinition {
  return {
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
      { productId: '12', variantId: null, quantity: 1 },
    ],
    ...overrides,
  };
}

/** An active physical product with one default variant at its price. */
export function aProduct(overrides: Partial<ComponentProduct> & { id: string }): ComponentProduct {
  const price = overrides.price ?? 1000;
  return {
    type: 'physical',
    status: 'active',
    price,
    weight: null,
    optionGroups: [],
    variants: [{ id: `${overrides.id}01`, price, optionValues: [] }],
    ...overrides,
  };
}

/** A product with one option group `name` and one variant per value, priced `price`. */
export function aSizedProduct(id: string, name: string, values: readonly string[], price = 1000): ComponentProduct {
  return aProduct({
    id,
    price,
    optionGroups: [{ name, values }],
    variants: values.map((value, index) => ({ id: `${id}0${String(index + 1)}`, price, optionValues: [value] })),
  });
}

/** A stored pack of product `productId` (business and store are the repository's). */
export function aPackRecord(productId: string, overrides: Partial<PackRecord> = {}): PackRecord {
  return {
    id: toSnowflake(`9${productId}`),
    productId,
    status: 'ok',
    ...aDefinition(),
    ...overrides,
  };
}
