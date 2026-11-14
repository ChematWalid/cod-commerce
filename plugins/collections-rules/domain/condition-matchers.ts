import { normalForMatch, type RuleCondition, type RuleField } from '@cod/shared';
import type { ProductFacts } from './product-facts';

/** The condition of one field, e.g. `ConditionOf<'price'>` has `min` and `max`. */
export type ConditionOf<F extends RuleField> = Extract<RuleCondition, { field: F }>;

/** Tests one condition of field `F` against a product's facts. */
export type ConditionMatcher<F extends RuleField> = (condition: ConditionOf<F>, facts: ProductFacts) => boolean;

/** The operators of the set fields (tag, brand, option), as the shared contract lists them. */
type SetOperator = ConditionOf<'tag'>['operator'];

/** `is_any_of` holds when some value is present, `is_not` when none is (D2303: `is_not [a, b]` = neither). */
const holdsSet = (operator: SetOperator, present: (value: string) => boolean, values: readonly string[]) =>
  operator === 'is_any_of' ? values.some(present) : !values.some(present);

/**
 * Caches a derived value per object. A recompute reads one rule against up to thousands of products under the store
 * lock (D2312), so each rule text and each product text is put in normal form once, not once per pair.
 */
function memoised<K extends object, V>(derive: (key: K) => V): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key) => {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const derived = derive(key);
    cache.set(key, derived);
    return derived;
  };
}

/** The normal forms of a condition's values (D2305). */
const normalValuesOf = memoised((condition: ConditionOf<'title'> | ConditionOf<'option'>): readonly string[] =>
  condition.values.map(normalForMatch),
);

/** The normal form of an option condition's option name. */
const normalOptionOf = memoised((condition: ConditionOf<'option'>): string => normalForMatch(condition.option));

/** The normal form of a product's title. */
const normalTitleOf = memoised((facts: ProductFacts): string => normalForMatch(facts.title));

/** For each option name in normal form, the normal forms of the values the visible variants carry (D2304, D2305). */
const normalOptionsOf = memoised((facts: ProductFacts): ReadonlyMap<string, ReadonlySet<string>> => {
  const carried = new Map<string, Set<string>>();
  for (const option of facts.variantOptions.flat()) {
    const name = normalForMatch(option.name);
    const values = carried.get(name) ?? new Set<string>();
    values.add(normalForMatch(option.value));
    carried.set(name, values);
  }
  return carried;
});

/** `contains` holds when some value is in the title, `not_contains` when none is, both in normal form (D2305). */
const matchTitle: ConditionMatcher<'title'> = (condition, facts) => {
  const title = normalTitleOf(facts);
  const inTitle = (value: string) => title.includes(value);
  const values = normalValuesOf(condition);
  return condition.operator === 'contains' ? values.some(inTitle) : !values.some(inTitle);
};

const matchOption: ConditionMatcher<'option'> = (condition, facts) => {
  const carried = normalOptionsOf(facts).get(normalOptionOf(condition));
  return holdsSet(condition.operator, (value) => carried?.has(value) ?? false, normalValuesOf(condition));
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
