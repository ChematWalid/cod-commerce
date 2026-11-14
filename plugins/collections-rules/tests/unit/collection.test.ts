import { COLLECTION_MAX_MANUAL_PRODUCTS, NORMAL_FORM_VERSION } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { type CollectionDefinition, switchMode } from '../../domain/collection';
import {
  InvalidCollectionInputError,
  InvalidCollectionRuleError,
  TooManyManualProductsError,
} from '../../domain/errors';
import { manualMembers, ruleMembers } from '../../domain/membership';
import { PROMO_TAG, ruleOf, tagIs } from './rule-fixtures';

const PROMO_RULE = ruleOf('all', tagIs('is_any_of', PROMO_TAG));

const definition = (overrides: Partial<CollectionDefinition> = {}): CollectionDefinition => ({
  id: '1400000000000000001',
  collectionId: '12',
  storeId: '1100000000000000001',
  mode: 'automatic',
  rule: PROMO_RULE,
  matchVersion: NORMAL_FORM_VERSION,
  visible: true,
  position: 0,
  ...overrides,
});

describe('switchMode', () => {
  it('keeps the members and their order when an automatic collection turns manual (D2302)', () => {
    // Arrange
    const current = ruleMembers(['3', '12', '7']);

    // Act
    const switched = switchMode(definition(), 'manual', null, current);

    // Assert
    expect(switched.definition).toEqual(definition({ mode: 'manual', rule: null }));
    expect(switched.members).toEqual(manualMembers(['12', '7', '3']));
  });

  it('asks for a recompute when a manual collection turns automatic', () => {
    // Arrange
    const manual = definition({ mode: 'manual', rule: null });

    // Act
    const switched = switchMode(manual, 'automatic', PROMO_RULE, manualMembers(['5', '6']));

    // Assert
    expect(switched.definition).toEqual(definition({ mode: 'automatic', rule: PROMO_RULE }));
    expect(switched.members).toBe('recompute');
  });

  it('asks for a recompute when an automatic collection gets a new rule', () => {
    // Arrange
    const newRule = ruleOf('any', tagIs('is_not', PROMO_TAG));

    // Act
    const switched = switchMode(definition(), 'automatic', newRule, ruleMembers(['1']));

    // Assert
    expect(switched.definition.rule).toEqual(newRule);
    expect(switched.members).toBe('recompute');
  });

  it('keeps the members of a manual collection that stays manual', () => {
    // Arrange
    const manual = definition({ mode: 'manual', rule: null });
    const current = manualMembers(['5', '6']);

    // Act
    const switched = switchMode(manual, 'manual', null, current);

    // Assert
    expect(switched.members).toEqual(current);
  });

  it('refuses an automatic collection without rule and a manual one with a rule', () => {
    // Arrange
    const manual = definition({ mode: 'manual', rule: null });

    // Act
    const automaticWithoutRule = () => switchMode(manual, 'automatic', null, []);
    const manualWithRule = () => switchMode(definition(), 'manual', PROMO_RULE, []);

    // Assert
    expect(automaticWithoutRule).toThrow(InvalidCollectionRuleError);
    expect(manualWithRule).toThrow(InvalidCollectionInputError);
  });

  it('refuses to turn manual an automatic collection holding more products than the manual cap', () => {
    // Arrange
    const current = ruleMembers(
      Array.from({ length: COLLECTION_MAX_MANUAL_PRODUCTS + 1 }, (_, index) => String(index + 1)),
    );

    // Act
    const act = () => switchMode(definition(), 'manual', null, current);

    // Assert
    expect(act).toThrow(TooManyManualProductsError);
  });
});
