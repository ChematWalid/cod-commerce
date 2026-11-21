import { type CollectionRule, type RuleCondition, toSnowflake } from '@cod/shared';
import { type ConditionOf } from '../../domain/condition-matchers';
import { type ProductSnapshot, productFactsOf, type ProductFacts } from '../../domain/product-facts';

/** Our tag ids of the fixtures: snowflakes, as the rule schema requires. */
export const PROMO_TAG = '1200000000000000001';
export const SUMMER_TAG = '1200000000000000002';
export const UNKNOWN_TAG = '1200000000000000099';
export const ACME_BRAND = '1300000000000000001';
export const OTHER_BRAND = '1300000000000000002';

/** A product with one visible variant at its own price and no option, unless the overrides say otherwise. */
export const snapshot = (
  overrides: Partial<ProductSnapshot> & Pick<ProductSnapshot, 'productId'>,
): ProductSnapshot => ({
  title: 'Plain product',
  brandId: null,
  tagIds: [],
  price: 2_000,
  variants: [{ hidden: false, price: overrides.price ?? 2_000, oldPrice: null, options: [] }],
  ...overrides,
});

/** The facts of {@link snapshot}. */
export const facts = (overrides: Partial<ProductSnapshot> & Pick<ProductSnapshot, 'productId'>): ProductFacts =>
  productFactsOf(snapshot(overrides));

/** A version-1 rule over the given conditions. */
export const ruleOf = (match: CollectionRule['match'], ...conditions: RuleCondition[]): CollectionRule => ({
  version: 1,
  match,
  conditions,
});

export const tagIs = (operator: ConditionOf<'tag'>['operator'], ...values: string[]): RuleCondition => ({
  field: 'tag',
  operator,
  values: values.map(toSnowflake),
});

export const brandIs = (operator: ConditionOf<'brand'>['operator'], ...values: string[]): RuleCondition => ({
  field: 'brand',
  operator,
  values: values.map(toSnowflake),
});

export const priceBetween = (min: number | null, max: number | null): RuleCondition => ({
  field: 'price',
  operator: 'between',
  min,
  max,
});

export const onSaleIs = (value: boolean): RuleCondition => ({ field: 'on_sale', operator: 'is', value });

export const titleIs = (operator: ConditionOf<'title'>['operator'], ...values: string[]): RuleCondition => ({
  field: 'title',
  operator,
  values,
});

export const optionIs = (
  option: string,
  operator: ConditionOf<'option'>['operator'],
  ...values: string[]
): RuleCondition => ({
  field: 'option',
  option,
  operator,
  values,
});
