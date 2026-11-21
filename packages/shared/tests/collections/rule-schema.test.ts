import { describe, expect, it } from 'vitest';
import {
  COLLECTION_RULE_MAX_CONDITIONS,
  COLLECTION_RULE_MAX_VALUES,
  COLLECTION_RULE_TEXT_MAX,
  COLLECTIONS_ERROR_CODES,
  collectionRuleSchema,
  RULE_FIELDS,
  RULE_OPERATORS_BY_FIELD,
} from '../../src/index';

const TAG_ID = '1200000000000000001';
const NUL = String.fromCodePoint(0);

const AC1_RULE = {
  version: 1,
  match: 'all',
  conditions: [
    { field: 'tag', operator: 'is_any_of', values: [TAG_ID] },
    { field: 'price', operator: 'between', min: 1000, max: 5000 },
  ],
};

/** A valid condition of each field, without its operator. */
const MINIMAL_CONDITIONS: Record<(typeof RULE_FIELDS)[number], Record<string, unknown>> = {
  tag: { field: 'tag', values: [TAG_ID] },
  brand: { field: 'brand', values: [TAG_ID] },
  price: { field: 'price', min: 1 },
  on_sale: { field: 'on_sale', value: true },
  title: { field: 'title', values: ['shoe'] },
  option: { field: 'option', option: 'Color', values: ['Red'] },
};

/** A rule of one condition, matched with "all". */
function ruleOf(condition: unknown): unknown {
  return { version: 1, match: 'all', conditions: [condition] };
}

/** `count` distinct snowflake ids. */
function idsOf(count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => String(1_200_000_000_000_000_000n + BigInt(index)));
}

/** Parses `rule` and expects a refusal whose every issue carries `collections.rule-invalid`. */
function expectRuleRefused(rule: unknown): void {
  const result = collectionRuleSchema.safeParse(rule);

  expect(result.success).toBe(false);
  const messages = result.error?.issues.map(({ message }) => message) ?? [];
  expect(messages.length).toBeGreaterThan(0);
  expect(messages.every((message) => message === COLLECTIONS_ERROR_CODES.RULE_INVALID)).toBe(true);
}

describe('collection rule schema', () => {
  it('accepts the AC1 rule', () => {
    // Act
    const result = collectionRuleSchema.safeParse(AC1_RULE);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toEqual(AC1_RULE);
  });

  it('refuses a missing or unknown version', () => {
    // Arrange
    const withoutVersion = { match: AC1_RULE.match, conditions: AC1_RULE.conditions };

    // Act + Assert
    expectRuleRefused(withoutVersion);
    expectRuleRefused({ ...AC1_RULE, version: 2 });
    expectRuleRefused({ ...AC1_RULE, version: '1' });
  });

  it('refuses an unknown match or field', () => {
    expectRuleRefused({ ...AC1_RULE, match: 'some' });
    expectRuleRefused(ruleOf({ field: 'stock', operator: 'is', value: true }));
    expectRuleRefused(null);
    expectRuleRefused('rule');
  });

  it('refuses price with no bound', () => {
    expectRuleRefused(ruleOf({ field: 'price', operator: 'between', min: null, max: null }));
    expectRuleRefused(ruleOf({ field: 'price', operator: 'between' }));
  });

  it('accepts price with only min or only max', () => {
    const onlyMin = collectionRuleSchema.parse(ruleOf({ field: 'price', operator: 'between', min: 1000 }));
    const onlyMax = collectionRuleSchema.parse(ruleOf({ field: 'price', operator: 'between', min: null, max: 10 }));

    expect(onlyMin.conditions[0]).toEqual({ field: 'price', operator: 'between', min: 1000, max: null });
    expect(onlyMax.conditions[0]).toEqual({ field: 'price', operator: 'between', min: null, max: 10 });
  });

  it('refuses min greater than max', () => {
    expectRuleRefused(ruleOf({ field: 'price', operator: 'between', min: 5000, max: 1000 }));
  });

  it('refuses a negative or non-integer price', () => {
    expectRuleRefused(ruleOf({ field: 'price', operator: 'between', min: -1, max: 10 }));
    expectRuleRefused(ruleOf({ field: 'price', operator: 'between', min: 1.5, max: 10 }));
    expectRuleRefused(ruleOf({ field: 'price', operator: 'between', min: 0, max: 2_147_483_648 }));
  });

  it(`refuses ${String(COLLECTION_RULE_MAX_CONDITIONS + 1)} conditions`, () => {
    // Arrange
    const condition = { field: 'on_sale', operator: 'is', value: true };
    const conditions = Array.from({ length: COLLECTION_RULE_MAX_CONDITIONS + 1 }, () => condition);

    // Act + Assert
    expectRuleRefused({ version: 1, match: 'any', conditions });
    expect(collectionRuleSchema.safeParse({ version: 1, match: 'any', conditions: conditions.slice(1) }).success).toBe(
      true,
    );
  });

  it('refuses a rule without conditions', () => {
    expectRuleRefused({ version: 1, match: 'all', conditions: [] });
  });

  it(`refuses ${String(COLLECTION_RULE_MAX_VALUES + 1)} values`, () => {
    const values = idsOf(COLLECTION_RULE_MAX_VALUES + 1);

    expectRuleRefused(ruleOf({ field: 'tag', operator: 'is_any_of', values }));
    expect(
      collectionRuleSchema.safeParse(ruleOf({ field: 'tag', operator: 'is_any_of', values: values.slice(1) })).success,
    ).toBe(true);
  });

  it('refuses an empty values list', () => {
    expectRuleRefused(ruleOf({ field: 'tag', operator: 'is_any_of', values: [] }));
    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: [] }));
    expectRuleRefused(ruleOf({ field: 'option', option: 'Color', operator: 'is_not', values: [] }));
  });

  it('refuses an operator of another field (price + is_not)', () => {
    expectRuleRefused(ruleOf({ field: 'price', operator: 'is_not', min: 1, max: 2 }));
    expectRuleRefused(ruleOf({ field: 'tag', operator: 'contains', values: [TAG_ID] }));
    expectRuleRefused(ruleOf({ field: 'on_sale', operator: 'is_not', value: true }));
  });

  it(`refuses a title value of ${String(COLLECTION_RULE_TEXT_MAX + 1)} chars or with a control character`, () => {
    const longest = 'a'.repeat(COLLECTION_RULE_TEXT_MAX);

    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: [`${longest}a`] }));
    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: [`shoe${NUL}`] }));
    expect(
      collectionRuleSchema.safeParse(ruleOf({ field: 'title', operator: 'contains', values: [longest] })).success,
    ).toBe(true);
  });

  it('refuses a title value made only of harakat, tatweel or spaces', () => {
    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: ['َُِ'] }));
    expectRuleRefused(ruleOf({ field: 'title', operator: 'not_contains', values: ['ــ'] }));
    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: ['   '] }));
  });

  it('refuses a value made only of zero-width characters', () => {
    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: ['\u200C'] }));
    expectRuleRefused(ruleOf({ field: 'option', option: '\u200D', operator: 'is_any_of', values: ['Red'] }));
  });

  it('refuses two option or title values that read the same once folded', () => {
    expectRuleRefused(ruleOf({ field: 'option', option: 'Color', operator: 'is_any_of', values: ['Red', 'red'] }));
    expectRuleRefused(ruleOf({ field: 'title', operator: 'contains', values: ['حذاء', 'حِذاء'] }));
  });

  it('refuses a malformed tag id (abc, -1, 1.5)', () => {
    for (const id of ['abc', '-1', '1.5', '', '01', '99999999999999999999']) {
      expectRuleRefused(ruleOf({ field: 'tag', operator: 'is_any_of', values: [id] }));
      expectRuleRefused(ruleOf({ field: 'brand', operator: 'is_not', values: [id] }));
    }
    expectRuleRefused(ruleOf({ field: 'tag', operator: 'is_any_of', values: [1] }));
  });

  it('refuses the same tag id twice', () => {
    expectRuleRefused(ruleOf({ field: 'tag', operator: 'is_any_of', values: [TAG_ID, TAG_ID] }));
  });

  it('accepts an option condition with an Arabic option name and values', () => {
    // Arrange
    const condition = { field: 'option', option: 'اللون', operator: 'is_any_of', values: ['أحمر', 'أزرق'] };

    // Act
    const result = collectionRuleSchema.safeParse(ruleOf(condition));

    // Assert
    expect(result.success).toBe(true);
    expect(result.data?.conditions[0]).toEqual(condition);
  });

  it('accepts on sale and brand conditions', () => {
    const rule = {
      version: 1,
      match: 'any',
      conditions: [
        { field: 'on_sale', operator: 'is', value: false },
        { field: 'brand', operator: 'is_not', values: [TAG_ID] },
      ],
    };

    expect(collectionRuleSchema.parse(rule)).toEqual(rule);
  });

  it('lists the operators of every field for the rule builder', () => {
    expect(Object.keys(RULE_OPERATORS_BY_FIELD).sort()).toEqual([...RULE_FIELDS].sort());
    expect(RULE_OPERATORS_BY_FIELD.price).toEqual(['between']);
    expect(RULE_OPERATORS_BY_FIELD.title).toEqual(['contains', 'not_contains']);
  });

  it('accepts exactly the operators the rule builder lists for each field', () => {
    // Arrange
    const allOperators = new Set(Object.values(RULE_OPERATORS_BY_FIELD).flat());

    for (const field of RULE_FIELDS) {
      const listed: readonly string[] = RULE_OPERATORS_BY_FIELD[field];
      for (const operator of allOperators) {
        // Act
        const result = collectionRuleSchema.safeParse(ruleOf({ ...MINIMAL_CONDITIONS[field], operator }));

        // Assert
        expect({ field, operator, accepted: result.success }).toEqual({
          field,
          operator,
          accepted: listed.includes(operator),
        });
      }
    }
  });
});
