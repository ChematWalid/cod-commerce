import { normalForMatch, RULE_FIELDS, RULE_OPERATORS_BY_FIELD, type RuleField } from '@cod/shared';
import type { StoreCollectionConditionDto, StoreCollectionRuleOptionsDto } from '../dto';

/**
 * A field the builder's field select offers. Every option name of the store is a field of its own (AC3), so a
 * condition on Color and one on Size are told apart by `option`.
 */
export interface ConditionFieldChoice {
  /** The select's value: the field, or `option:` and the option name. */
  readonly key: string;
  readonly field: RuleField;
  readonly option: string | null;
}

/** A value a multi-select offers: a tag or brand id with its name, or an option value standing for itself. */
export interface ValueChoice {
  readonly id: string;
  readonly name: string;
}

const OPTION_KEY_PREFIX = 'option:';

type FixedField = Exclude<RuleField, 'option'>;
const FIXED_FIELDS = RULE_FIELDS.filter((field): field is FixedField => field !== 'option');
type RuleOperator = (typeof RULE_OPERATORS_BY_FIELD)[RuleField][number];

/** The catalogue id of each field's label; an option field shows the merchant's option name instead. */
const FIELD_LABEL_IDS = {
  tag: 'collections.field-tag',
  brand: 'collections.field-brand',
  price: 'collections.field-price',
  on_sale: 'collections.field-on_sale',
  title: 'collections.field-title',
  option: 'collections.field-option',
} as const satisfies Readonly<Record<RuleField, string>>;

/** The catalogue id of each operator's label. */
const OPERATOR_LABEL_IDS = {
  is_any_of: 'collections.operator-is_any_of',
  is_not: 'collections.operator-is_not',
  between: 'collections.operator-between',
  is: 'collections.operator-is',
  contains: 'collections.operator-contains',
  not_contains: 'collections.operator-not_contains',
} as const satisfies Readonly<Record<RuleOperator, string>>;

export const fieldLabelIdOf = (field: RuleField): string => FIELD_LABEL_IDS[field];
/** An operator's label id; an operator the registry does not know (a later rule version) shows as typed. */
export const operatorLabelIdOf = (operator: string): string =>
  (OPERATOR_LABEL_IDS as Readonly<Record<string, string>>)[operator] ?? operator;

/** Every field and operator label id, built from the registries the rule schema reads (D89). */
export const RULE_LABEL_IDS: readonly string[] = [
  ...RULE_FIELDS.map(fieldLabelIdOf),
  ...[...new Set(Object.values(RULE_OPERATORS_BY_FIELD).flat())].map(operatorLabelIdOf),
];

const optionChoice = (option: string): ConditionFieldChoice => ({
  key: `${OPTION_KEY_PREFIX}${option}`,
  field: 'option',
  option,
});

/** The fields of the store: tag, brand, price, on sale and title, then one per option name of its variants. */
export function conditionFieldsOf(options: StoreCollectionRuleOptionsDto | undefined): readonly ConditionFieldChoice[] {
  const fixed = FIXED_FIELDS.map((field): ConditionFieldChoice => ({ key: field, field, option: null }));
  return [...fixed, ...(options?.options ?? []).map(({ name }) => optionChoice(name))];
}

/** The field choice a condition stands on, its stored option name kept even if the store no longer has it. */
export const fieldChoiceOf = (condition: StoreCollectionConditionDto): ConditionFieldChoice =>
  condition.field === 'option'
    ? optionChoice(condition.option ?? '')
    : { key: condition.field, field: condition.field as RuleField, option: null };

/** The operators a field takes, in the order the builder offers them. */
export const operatorsOf = (field: string): readonly string[] =>
  (RULE_OPERATORS_BY_FIELD as Readonly<Record<string, readonly string[]>>)[field] ?? [];

/** The values of the store's option that reads as `option` once folded (D2305), or none. */
function optionValuesOf(options: StoreCollectionRuleOptionsDto, option: string | null | undefined) {
  const wanted = normalForMatch(option ?? '');
  const found = options.options.find(({ name }) => normalForMatch(name) === wanted);
  return (found?.values ?? []).map((value) => ({ id: value, name: value }));
}

/**
 * What a condition's multi-select offers: the store's tags, brands or option values; null for a field without a
 * list (title words are typed, price and on sale have their own inputs).
 */
export function valueChoicesOf(
  condition: StoreCollectionConditionDto,
  options: StoreCollectionRuleOptionsDto,
): readonly ValueChoice[] | null {
  if (condition.field === 'tag') return options.tags;
  if (condition.field === 'brand') return options.brands;
  if (condition.field === 'option') return optionValuesOf(options, condition.option);
  return null;
}

/** How a condition's values are entered: decided by its field alone, so loading options never changes the input. */
export type ValueInput =
  | { readonly kind: 'range' }
  | { readonly kind: 'yes-no' }
  | { readonly kind: 'words' }
  /** A field with a list whose options have not arrived (loading or failed): nothing is flagged unknown yet. */
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'choices'; readonly choices: readonly ValueChoice[] };

const LIST_FIELDS: ReadonlySet<string> = new Set<RuleField>(['tag', 'brand', 'option']);

/** The input of a condition's values: a range, yes/no, typed words, or the store's list once it is loaded. */
export function valueInputOf(
  condition: StoreCollectionConditionDto,
  options: StoreCollectionRuleOptionsDto | undefined,
): ValueInput {
  if (condition.field === 'price') return { kind: 'range' };
  if (condition.field === 'on_sale') return { kind: 'yes-no' };
  if (!LIST_FIELDS.has(condition.field)) return { kind: 'words' };
  if (options === undefined) return { kind: 'unavailable' };
  return { kind: 'choices', choices: valueChoicesOf(condition, options) ?? [] };
}

/** Option values are matched once folded (D2305), so `Red` and `red` are one value; tag and brand ids are exact. */
const sameValue = (field: string, left: string, right: string): boolean =>
  field === 'option' ? normalForMatch(left) === normalForMatch(right) : left === right;

/** Whether `id` is among the stored values, by the field's own comparison. */
export const isPickedValue = (values: readonly string[], id: string, field: string): boolean =>
  values.some((value) => sameValue(field, value, id));

/** Picks `id`, or drops every stored value that reads as it. */
export const withToggledValue = (values: readonly string[], id: string, field: string): readonly string[] =>
  isPickedValue(values, id, field) ? values.filter((value) => !sameValue(field, value, id)) : [...values, id];

/** The stored values the store no longer offers (D2307), shown as unknown so they can be removed. */
export const unknownValuesOf = (
  values: readonly string[],
  choices: readonly ValueChoice[],
  field: string,
): readonly string[] => values.filter((value) => !choices.some(({ id }) => sameValue(field, id, value)));
