import {
  COLLECTION_RULE_MAX_CONDITIONS,
  COLLECTION_RULE_VERSION,
  collectionRuleSchema,
  ruleConditionSchema,
  type RuleMatch,
} from '@cod/shared';
import type { StoreCollectionConditionDto, StoreCollectionRuleDto } from '../dto';
import { type ConditionFieldChoice, operatorsOf } from './condition-fields';

/**
 * The rule as the builder edits it: the API's shape, where a row may still be incomplete (no value picked, no price
 * bound). The server takes the unused fields as null, so a complete draft is sent as it is.
 */
export type RuleDraft = StoreCollectionRuleDto;

/** A rule without rows, matching all of them. */
export const emptyRule = (): RuleDraft => ({ version: COLLECTION_RULE_VERSION, match: 'all', conditions: [] });

/** A new row on `choice`: its first operator, nothing picked; an on-sale row starts at "yes". */
export const conditionFor = (choice: ConditionFieldChoice): StoreCollectionConditionDto => ({
  field: choice.field,
  operator: operatorsOf(choice.field)[0] ?? '',
  option: choice.option,
  values: [],
  min: null,
  max: null,
  value: choice.field === 'on_sale' ? true : null,
});

const withConditions = (rule: RuleDraft, conditions: readonly StoreCollectionConditionDto[]): RuleDraft => ({
  ...rule,
  conditions,
});

export const withMatch = (rule: RuleDraft, match: RuleMatch): RuleDraft => ({ ...rule, match });

/** Adds a row at the end, up to the cap of D2322. */
export const withAddedCondition = (rule: RuleDraft, choice: ConditionFieldChoice): RuleDraft =>
  rule.conditions.length >= COLLECTION_RULE_MAX_CONDITIONS
    ? rule
    : withConditions(rule, [...rule.conditions, conditionFor(choice)]);

export const withoutCondition = (rule: RuleDraft, index: number): RuleDraft =>
  withConditions(
    rule,
    rule.conditions.filter((_, at) => at !== index),
  );

/** Changes some fields of one row (operator, values, bounds). */
export const withConditionChange = (
  rule: RuleDraft,
  index: number,
  change: Partial<StoreCollectionConditionDto>,
): RuleDraft =>
  withConditions(
    rule,
    rule.conditions.map((condition, at) => (at === index ? { ...condition, ...change } : condition)),
  );

/** Moves a row to another field: its operator and values mean nothing there, so the row starts over. */
export const withFieldChoice = (rule: RuleDraft, index: number, choice: ConditionFieldChoice): RuleDraft =>
  withConditions(
    rule,
    rule.conditions.map((condition, at) => (at === index ? conditionFor(choice) : condition)),
  );

/** Whether the server would take the rule as it is: every row complete (the server checks again). */
export const isCompleteRule = (rule: RuleDraft | null): boolean =>
  rule !== null && collectionRuleSchema.safeParse(rule).success;

/**
 * The rule a preview asks for: the complete rows only, so a half-typed row does not blank the count; null while no
 * row is complete.
 */
export function previewRuleOf(rule: RuleDraft | null): RuleDraft | null {
  if (rule === null) return null;
  const complete = rule.conditions.filter((condition) => ruleConditionSchema.safeParse(condition).success);
  return complete.length === 0 ? null : withConditions(rule, complete);
}
