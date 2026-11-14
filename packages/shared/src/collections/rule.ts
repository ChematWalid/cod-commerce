import { z } from 'zod';
import { MONEY_MAX_DZD } from '../catalog/money';
import { isSnowflake } from '../ids/snowflake';
import {
  COLLECTION_OPTION_NAME_MAX,
  COLLECTION_RULE_MAX_CONDITIONS,
  COLLECTION_RULE_MAX_TEXT_VALUES,
  COLLECTION_RULE_MAX_VALUES,
  COLLECTION_RULE_TEXT_MAX,
  COLLECTION_RULE_VERSION,
  RULE_MATCHES,
  RULE_OPERATORS_BY_FIELD,
} from './constants';
import { collectionTextSchema, invalidCollectionRule as issue } from './fields';
import { normalForMatch } from './text-normal';

/** A rule text that still says something once folded: one made only of harakat, tatweel or spaces never matches. */
const ruleTextSchema = (max: number) =>
  collectionTextSchema(max, issue).refine((value) => normalForMatch(value) !== '', issue);

/** Our tag or brand ids (D2307): snowflakes, never one twice. */
const snowflakeValuesSchema = z
  .array(z.string(issue).refine(isSnowflake, issue), issue)
  .min(1, issue)
  .max(COLLECTION_RULE_MAX_VALUES, issue)
  .refine((ids) => new Set(ids).size === ids.length, issue);

/** Rule texts, never two that read the same once folded (`Red` and `red` are one value). */
const textValuesSchema = (maxValues: number) =>
  z
    .array(ruleTextSchema(COLLECTION_RULE_TEXT_MAX), issue)
    .min(1, issue)
    .max(maxValues, issue)
    .refine((values) => new Set(values.map(normalForMatch)).size === values.length, issue);

/** The operators of a field, from the registry the rule builder reads, so the two never drift. */
const operatorOf = <F extends keyof typeof RULE_OPERATORS_BY_FIELD>(field: F) =>
  z.enum(RULE_OPERATORS_BY_FIELD[field], issue);

const priceBoundSchema = z.number(issue).int(issue).min(0, issue).max(MONEY_MAX_DZD, issue).nullable().default(null);

const tagConditionSchema = z.object(
  { field: z.literal('tag', issue), operator: operatorOf('tag'), values: snowflakeValuesSchema },
  issue,
);

const brandConditionSchema = z.object(
  { field: z.literal('brand', issue), operator: operatorOf('brand'), values: snowflakeValuesSchema },
  issue,
);

/** Inclusive whole-DZD range with at least one bound (D2303). */
const priceConditionSchema = z
  .object(
    {
      field: z.literal('price', issue),
      operator: operatorOf('price'),
      min: priceBoundSchema,
      max: priceBoundSchema,
    },
    issue,
  )
  .refine(({ min, max }) => min !== null || max !== null, issue)
  .refine(({ min, max }) => min === null || max === null || min <= max, issue);

const onSaleConditionSchema = z.object(
  { field: z.literal('on_sale', issue), operator: operatorOf('on_sale'), value: z.boolean(issue) },
  issue,
);

const titleConditionSchema = z.object(
  {
    field: z.literal('title', issue),
    operator: operatorOf('title'),
    values: textValuesSchema(COLLECTION_RULE_MAX_TEXT_VALUES),
  },
  issue,
);

/** An option such as Color, named as the merchant typed it; matched by {@link normalForMatch} on variants. */
const optionConditionSchema = z.object(
  {
    field: z.literal('option', issue),
    option: ruleTextSchema(COLLECTION_OPTION_NAME_MAX),
    operator: operatorOf('option'),
    values: textValuesSchema(COLLECTION_RULE_MAX_VALUES),
  },
  issue,
);

/** One condition of a rule, told apart by its `field` (D2303). */
export const ruleConditionSchema = z.discriminatedUnion(
  'field',
  [
    tagConditionSchema,
    brandConditionSchema,
    priceConditionSchema,
    onSaleConditionSchema,
    titleConditionSchema,
    optionConditionSchema,
  ],
  issue,
);

/**
 * A stored collection rule (D2303): `all` of its conditions or `any` of them. Every refusal, wherever the rule is
 * nested, carries `collections.rule-invalid`.
 */
export const collectionRuleSchema = z.object(
  {
    version: z.literal(COLLECTION_RULE_VERSION, issue),
    match: z.enum(RULE_MATCHES, issue),
    conditions: z.array(ruleConditionSchema, issue).min(1, issue).max(COLLECTION_RULE_MAX_CONDITIONS, issue),
  },
  issue,
);

export type RuleCondition = z.output<typeof ruleConditionSchema>;
export type CollectionRule = z.output<typeof collectionRuleSchema>;
export type CollectionRuleInput = z.input<typeof collectionRuleSchema>;
