import type { CollectionRule, RuleCondition, RuleMatch } from '@cod/shared';
import { matchesCondition } from './condition-matchers';
import type { ProductFacts } from './product-facts';

type Combiner = (conditions: readonly RuleCondition[], holds: (condition: RuleCondition) => boolean) => boolean;

/** `all`: every condition holds; `any`: at least one does (D2303). */
const COMBINERS: { readonly [M in RuleMatch]: Combiner } = {
  all: (conditions, holds) => conditions.every(holds),
  any: (conditions, holds) => conditions.some(holds),
};

/** True when the product matches the rule. */
export function matchesRule(rule: CollectionRule, facts: ProductFacts): boolean {
  return COMBINERS[rule.match](rule.conditions, (condition) => matchesCondition(condition, facts));
}

/** The ids of the products that match the rule, in the given order. */
export function matchingIds(rule: CollectionRule, products: readonly ProductFacts[]): readonly string[] {
  return products.filter((facts) => matchesRule(rule, facts)).map((facts) => facts.productId);
}
