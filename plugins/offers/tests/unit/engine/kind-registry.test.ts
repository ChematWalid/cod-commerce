import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { InvalidOfferConfigError, UnknownOfferKindError } from '../../../domain/errors';
import { OfferKindRegistry, type OfferKindCalculator } from '../../../domain/engine/kind-registry';

/** A minimal calculator of `kind` whose config is `{ percent: 1..100 }`, skipping every offer. */
function aCalculator(kind: string): OfferKindCalculator<{ percent: number }> {
  return {
    kind,
    combinationClass: 'order',
    stage: 30,
    configSchema: z.object({ percent: z.number().int().min(1).max(100) }),
    evaluate: () => ({ kind: 'skip', reason: 'min_not_met' }),
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
