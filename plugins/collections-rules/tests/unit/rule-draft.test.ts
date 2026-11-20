import { COLLECTION_RULE_MAX_CONDITIONS } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { StoreCollectionRuleDto } from '../../dashboard/dto';
import type { ConditionFieldChoice } from '../../dashboard/model/condition-fields';
import {
  conditionFor,
  emptyRule,
  isCompleteRule,
  previewRuleOf,
  withAddedCondition,
  withConditionChange,
  withFieldChoice,
  withMatch,
  withoutCondition,
} from '../../dashboard/model/rule-draft';

const TAG_ID = '7301234567890123456';
const TAG: ConditionFieldChoice = { key: 'tag', field: 'tag', option: null };
const PRICE: ConditionFieldChoice = { key: 'price', field: 'price', option: null };
const COLOR: ConditionFieldChoice = { key: 'option:Color', field: 'option', option: 'Color' };

const tagRule = (): StoreCollectionRuleDto =>
  withConditionChange(withAddedCondition(emptyRule(), TAG), 0, { operator: 'is_not', values: [TAG_ID] });

describe('rule draft', () => {
  it('an incomplete row is left out of the preview request', () => {
    // Arrange
    const rule = withAddedCondition(withAddedCondition(tagRule(), PRICE), COLOR);

    // Act
    const preview = previewRuleOf(rule);

    // Assert
    expect(preview?.conditions).toEqual([expect.objectContaining({ field: 'tag', values: [TAG_ID] })]);
    expect(isCompleteRule(rule)).toBe(false);
    expect(isCompleteRule(withoutCondition(withoutCondition(rule, 2), 1))).toBe(true);
  });

  it('asks for no preview while no row is complete', () => {
    // Arrange
    const rule = withAddedCondition(emptyRule(), PRICE);

    // Act
    const preview = previewRuleOf(rule);

    // Assert
    expect(preview).toBeNull();
    expect(previewRuleOf(null)).toBeNull();
  });

  it('changing the field resets operator and values', () => {
    // Arrange
    const rule = tagRule();

    // Act
    const toColor = withFieldChoice(rule, 0, COLOR);
    const toPrice = withFieldChoice(rule, 0, PRICE);

    // Assert
    expect(toColor.conditions[0]).toEqual(conditionFor(COLOR));
    expect(toColor.conditions[0]).toMatchObject({
      field: 'option',
      option: 'Color',
      operator: 'is_any_of',
      values: [],
    });
    expect(toPrice.conditions[0]).toMatchObject({ field: 'price', operator: 'between', min: null, max: null });
  });

  it('switches All and Any without touching the rows', () => {
    // Arrange
    const rule = tagRule();

    // Act
    const any = withMatch(rule, 'any');

    // Assert
    expect(any).toEqual({ ...rule, match: 'any' });
  });

  it('adds rows up to the condition cap', () => {
    // Arrange
    let rule = emptyRule();

    // Act
    for (let index = 0; index <= COLLECTION_RULE_MAX_CONDITIONS; index += 1) rule = withAddedCondition(rule, TAG);

    // Assert
    expect(rule.conditions).toHaveLength(COLLECTION_RULE_MAX_CONDITIONS);
  });
});
