import { describe, expect, it } from 'vitest';
import { evaluateFlag } from '../../domain/evaluate';
import type { FlagSnapshot, FlagState, OverrideState } from '../../domain/snapshot';

const KEY = 'ai.enabled';
const BUSINESS = '7000000000000000001';
const OTHER_BUSINESS = '7000000000000000002';
const STORE = '7100000000000000001';

const flag = (patch: Partial<FlagState> = {}, overrides: readonly OverrideState[] = []): FlagSnapshot => ({
  flags: {
    [KEY]: {
      description: 'test flag',
      defaultEnabled: false,
      rolloutPercent: 100,
      updatedAt: '2026-01-01T00:00:00.000Z',
      overrides,
      ...patch,
    },
  },
});

const override = (scope: OverrideState['scope'], scopeId: string, enabled: boolean): OverrideState => ({
  scope,
  scopeId,
  enabled,
});

describe('evaluateFlag precedence', () => {
  const everything = [
    override('store', STORE, true),
    override('business', BUSINESS, false),
    override('plan', 'pro', true),
  ];

  it.each([
    ['store over business, plan and default', everything, { businessId: BUSINESS, storeId: STORE }, 'pro', true],
    [
      'business over plan and default',
      [override('business', BUSINESS, false), override('plan', 'pro', true)],
      { businessId: BUSINESS, storeId: STORE },
      'pro',
      false,
    ],
    [
      'plan over default',
      [override('plan', 'pro', true)],
      { businessId: BUSINESS, storeId: STORE },
      'pro',
      true,
    ],
    ['the default when nothing overrides', [], { businessId: BUSINESS, storeId: STORE }, 'pro', false],
  ] as const)('%s', (...[, overrides, subject, plan, expected]) => {
    // Act
    const result = evaluateFlag(flag({}, overrides), KEY, subject, plan);

    // Assert
    expect(result).toBe(expected);
  });

  it("ignores another business's and another store's overrides", () => {
    // Arrange
    const snapshot = flag({}, [override('business', OTHER_BUSINESS, true), override('store', '7100000000000000009', true)]);

    // Act and Assert
    expect(evaluateFlag(snapshot, KEY, { businessId: BUSINESS, storeId: STORE }, undefined)).toBe(false);
  });

  it('ignores plan overrides when the business has no plan or the plan key is unknown', () => {
    // Arrange
    const snapshot = flag({}, [override('plan', 'pro', true)]);

    // Act and Assert
    expect(evaluateFlag(snapshot, KEY, { businessId: BUSINESS }, undefined)).toBe(false);
    expect(evaluateFlag(snapshot, KEY, { businessId: BUSINESS }, 'unknown-plan')).toBe(false);
  });

  it('lets an override switch a flag off that the default has on', () => {
    // Arrange
    const snapshot = flag({ defaultEnabled: true }, [override('business', BUSINESS, false)]);

    // Act and Assert
    expect(evaluateFlag(snapshot, KEY, { businessId: BUSINESS }, undefined)).toBe(false);
    expect(evaluateFlag(snapshot, KEY, { businessId: OTHER_BUSINESS }, undefined)).toBe(true);
  });

  it('answers false for a key the snapshot does not hold', () => {
    // Act and Assert
    expect(evaluateFlag({ flags: {} }, KEY, { businessId: BUSINESS }, undefined)).toBe(false);
  });

  it('answers false when the default is off, whatever the rollout', () => {
    // Act and Assert
    expect(evaluateFlag(flag({ defaultEnabled: false, rolloutPercent: 100 }), KEY, { businessId: BUSINESS }, undefined)).toBe(
      false,
    );
  });
});

describe('evaluateFlag without a business', () => {
  it('is on only at a rollout of 100 %', () => {
    // Act and Assert
    expect(evaluateFlag(flag({ defaultEnabled: true, rolloutPercent: 100 }), KEY, {}, undefined)).toBe(true);
    expect(evaluateFlag(flag({ defaultEnabled: true, rolloutPercent: 99 }), KEY, {}, undefined)).toBe(false);
    expect(evaluateFlag(flag({ defaultEnabled: true, rolloutPercent: 0 }), KEY, {}, undefined)).toBe(false);
  });

  it('ignores plan overrides', () => {
    // Act and Assert
    expect(evaluateFlag(flag({}, [override('plan', 'pro', true)]), KEY, {}, 'pro')).toBe(false);
  });
});
