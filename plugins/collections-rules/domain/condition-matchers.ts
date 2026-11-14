import { normalForMatch, type RuleCondition, type RuleField } from '@cod/shared';
import type { ProductFacts } from './product-facts';

/** The condition of one field, e.g. `ConditionOf<'price'>` has `min` and `max`. */
export type ConditionOf<F extends RuleField> = Extract<RuleCondition, { field: F }>;

/** Tests one condition of field `F` against a product's facts. */
export type ConditionMatcher<F extends RuleField> = (condition: ConditionOf<F>, facts: ProductFacts) => boolean;

/** `is_any_of` holds when some value is present, `is_not` when none is (D2303: `is_not [a, b]` = neither). */
const holdsSet = (operator: 'is_any_of' | 'is_not', present: (value: string) => boolean, values: readonly string[]) =>
  operator === 'is_any_of' ? values.some(present) : !values.some(present);

/** `contains` holds when some value is in the title, `not_contains` when none is, both in normal form (D2305). */
const matchTitle: ConditionMatcher<'title'> = (condition, facts) => {
  const title = normalForMatch(facts.title);
  const inTitle = (value: string) => title.includes(normalForMatch(value));
  return condition.operator === 'contains' ? condition.values.some(inTitle) : !condition.values.some(inTitle);
};

/** The normal forms of the values the visible variants carry for option `name` (D2304, D2305). */
const optionValuesOf = (facts: ProductFacts, name: string): ReadonlySet<string> => {
  const wanted = normalForMatch(name);
  return new Set(
    facts.variantOptions.flatMap((options) =>
      options.filter((option) => normalForMatch(option.name) === wanted).map((option) => normalForMatch(option.value)),
    ),
  );
};

const matchOption: ConditionMatcher<'option'> = (condition, facts) => {
  const carried = optionValuesOf(facts, condition.option);
  return holdsSet(condition.operator, (value) => carried.has(normalForMatch(value)), condition.values);
};

/**
 * One matcher per rule field (CLAUDE.md §3a.7): a new field is a new entry here, never a branch in a `switch`.
 * A product without tag, brand or such option holds every `is_not` and no `is_any_of` (D2304).
 */
export const CONDITION_MATCHERS: { readonly [F in RuleField]: ConditionMatcher<F> } = {
  tag: (condition, facts) => holdsSet(condition.operator, (id) => facts.tagIds.includes(id), condition.values),
  brand: (condition, facts) => holdsSet(condition.operator, (id) => facts.brandId === id, condition.values),
  price: (condition, facts) =>
    (condition.min === null || facts.price >= condition.min) &&
    (condition.max === null || facts.price <= condition.max),
  on_sale: (condition, facts) => facts.onSale === condition.value,
  title: matchTitle,
  option: matchOption,
};

/** True when `condition` holds for the product, through the matcher of its field. */
export function matchesCondition(condition: RuleCondition, facts: ProductFacts): boolean {
  // TypeScript cannot tie the indexed matcher to the narrowed condition of the same field; the registry's type does.
  const matcher = CONDITION_MATCHERS[condition.field] as ConditionMatcher<RuleField>;
  return matcher(condition, facts);
}
