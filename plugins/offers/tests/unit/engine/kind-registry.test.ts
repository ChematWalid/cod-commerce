import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InvalidOfferConfigError, UnknownOfferKindError } from '../../../domain/errors';
import { OfferKindRegistry, type OfferKindCalculator } from '../../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../../domain/kinds';

/** A minimal calculator of `kind` whose config is `{ percent: 1..100 }`, skipping every offer. */
function aCalculator(kind: string): OfferKindCalculator<{ percent: number }> {
  return {
    kind,
    combinationClass: 'order',
    stage: 30,
    configSchema: z.object({ percent: z.number().int().min(1).max(100) }),
    evaluate: () => ({ kind: 'skip', reason: 'min_not_met' }),
    targetRules: () => ({ allowed: ['buy'], required: [] }),
  };
}

describe('OfferKindRegistry', () => {
  it('finds a calculator by its kind', () => {
    // Arrange
    const calculator = aCalculator('order_discount');
    const registry = new OfferKindRegistry([calculator, aCalculator('free_delivery')]);

    // Act
    const found = registry.get('order_discount');

    // Assert
    expect(found).toBe(calculator);
    expect(registry.kinds()).toEqual(['order_discount', 'free_delivery']);
  });

  it('answers undefined for a kind nobody registered', () => {
    // Arrange
    const registry = new OfferKindRegistry([aCalculator('order_discount')]);

    // Act
    const found = registry.get('bxgy');

    // Assert
    expect(found).toBeUndefined();
  });

  it('refuses two calculators of one kind', () => {
    // Arrange
    const calculators = [aCalculator('quantity'), aCalculator('quantity')];

    // Act
    const build = () => new OfferKindRegistry(calculators);

    // Assert
    expect(build).toThrow(/quantity/);
  });

  it('refuses an unknown kind', () => {
    // Arrange
    const registry = new OfferKindRegistry([aCalculator('order_discount')]);

    // Act
    const parse = () => registry.parseConfig('bxgy', { percent: 10 });

    // Assert
    expect(parse).toThrow(UnknownOfferKindError);
  });

  it('refuses a config its schema rejects', () => {
    // Arrange
    const registry = new OfferKindRegistry([aCalculator('order_discount')]);

    // Act
    const parse = () => registry.parseConfig('order_discount', { percent: 101 });

    // Assert
    expect(parse).toThrow(InvalidOfferConfigError);
  });

  it('returns the parsed config of a valid one', () => {
    // Arrange
    const registry = new OfferKindRegistry([aCalculator('order_discount')]);

    // Act
    const config = registry.parseConfig('order_discount', { percent: 10, extra: true });

    // Assert
    expect(config).toEqual({ percent: 10 });
  });
});

describe('OfferKindRegistry target rules (D2501)', () => {
  const builtIns = new OfferKindRegistry(BUILT_IN_OFFER_KINDS);

  it('reports quantity as requiring a buy target', () => {
    // Arrange
    const config = { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] };

    // Act
    const rules = builtIns.targetRulesOf('quantity', config);

    // Assert
    expect(rules).toEqual({ allowed: ['buy'], required: ['buy'] });
  });

  it('reports product discount on all products as requiring no target', () => {
    // Arrange
    const config = { valueType: 'percent', value: 10, appliesTo: 'all' };

    // Act
    const rules = builtIns.targetRulesOf('product_discount', config);

    // Assert
    expect(rules).toEqual({ allowed: ['buy'], required: [] });
  });

  it('reports product discount on targets as requiring a buy target', () => {
    // Arrange
    const config = { valueType: 'percent', value: 10, appliesTo: 'targets' };

    // Act
    const rules = builtIns.targetRulesOf('product_discount', config);

    // Assert
    expect(rules).toEqual({ allowed: ['buy'], required: ['buy'] });
  });

  it('reports order discount and free delivery as allowing buy targets and requiring none', () => {
    // Arrange
    const orderConfig = { valueType: 'fixed', value: 300 };

    // Act
    const orderRules = builtIns.targetRulesOf('order_discount', orderConfig);
    const deliveryRules = builtIns.targetRulesOf('free_delivery', {});

    // Assert
    expect(orderRules).toEqual({ allowed: ['buy'], required: [] });
    expect(deliveryRules).toEqual({ allowed: ['buy'], required: [] });
  });

  it('throws for target rules of an unknown kind', () => {
    // Act
    const read = () => builtIns.targetRulesOf('teleport', {});

    // Assert
    expect(read).toThrow(UnknownOfferKindError);
  });

  it('throws for target rules of a config its schema rejects', () => {
    // Act
    const read = () => builtIns.targetRulesOf('quantity', { tiers: 'many' });

    // Assert
    expect(read).toThrow(InvalidOfferConfigError);
  });
});
