import {
  COMMISSION_FIXED_MAX_DZD,
  COMMISSION_PERCENT_MAX_BPS,
  type CommissionConfigCommand,
  toSnowflake,
} from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  commissionChangedFields,
  commissionNameKeyOf,
  createCommissionConfig,
  reviseCommissionConfig,
} from '../../domain/commission-config';
import { InvalidInputError } from '../../domain/errors';
import { newId, scopeA, T0 } from '../support/builders';

const LATER = new Date(T0.getTime() + 60_000);

const command = (overrides: Partial<CommissionConfigCommand> = {}): CommissionConfigCommand => ({
  name: 'Confirmation bonus',
  basis: 'per-confirmed-order',
  valueKind: 'percent',
  value: 250,
  scope: 'all',
  storeIds: [],
  ...overrides,
});

const create = (overrides: Partial<CommissionConfigCommand> = {}) =>
  createCommissionConfig({ id: newId(), scope: scopeA, command: command(overrides), now: T0 });

describe('createCommissionConfig', () => {
  it('accepts a percent of exactly 100 %', () => {
    // Act
    const config = create({ value: COMMISSION_PERCENT_MAX_BPS });

    // Assert
    expect(config.value).toBe(COMMISSION_PERCENT_MAX_BPS);
    expect(config.businessId).toBe(scopeA.businessId);
  });

  it('refuses a percent above 100 %', () => {
    // Act and assert
    expect(() => create({ value: COMMISSION_PERCENT_MAX_BPS + 1 })).toThrow(InvalidInputError);
  });

  it('accepts a fixed amount up to its cap and refuses one above', () => {
    // Act and assert
    expect(create({ valueKind: 'fixed', value: COMMISSION_FIXED_MAX_DZD }).value).toBe(COMMISSION_FIXED_MAX_DZD);
    expect(() => create({ valueKind: 'fixed', value: COMMISSION_FIXED_MAX_DZD + 1 })).toThrow(InvalidInputError);
  });

  it.each([0, -5, 12.5])('refuses the value %s', (value) => {
    // Act and assert
    expect(() => create({ value })).toThrow(InvalidInputError);
  });

  it('refuses a selected scope without a store', () => {
    // Act and assert
    expect(() => create({ scope: 'selected', storeIds: [] })).toThrow(InvalidInputError);
  });

  it('drops the stores of an all-store commission', () => {
    // Act
    const config = create({ scope: 'all', storeIds: [toSnowflake('77')] });

    // Assert
    expect(config.storeIds).toEqual([]);
  });

  it('refuses a blank name', () => {
    // Act and assert
    expect(() => create({ name: '   ' })).toThrow(InvalidInputError);
  });
});

describe('commissionNameKeyOf', () => {
  it('folds case and spaces, so two spellings of one name collide', () => {
    // Act and assert
    expect(commissionNameKeyOf('  Confirmation   BONUS ')).toBe(commissionNameKeyOf('confirmation bonus'));
  });
});

describe('reviseCommissionConfig', () => {
  it('applies a rename and a new value, keeping the id, the stores and the creation time', () => {
    // Arrange
    const config = create({ scope: 'selected', storeIds: [toSnowflake('11')] });

    // Act
    const revised = reviseCommissionConfig(config, { name: '  Delivered   bonus ', value: 300 }, LATER);

    // Assert
    expect(revised).toEqual({
      ...config,
      name: 'Delivered bonus',
      nameKey: 'delivered bonus',
      value: 300,
      updatedAt: LATER,
    });
  });

  it('refuses a switch to percent that leaves the value above 100 %', () => {
    // Arrange
    const config = create({ valueKind: 'fixed', value: COMMISSION_PERCENT_MAX_BPS + 1 });

    // Act and assert
    expect(() => reviseCommissionConfig(config, { valueKind: 'percent' }, LATER)).toThrow(InvalidInputError);
  });

  it('refuses a blank name', () => {
    // Act and assert
    expect(() => reviseCommissionConfig(create(), { name: ' ' }, LATER)).toThrow(InvalidInputError);
  });

  it('drops the stores when the scope becomes all', () => {
    // Arrange
    const config = create({ scope: 'selected', storeIds: [toSnowflake('11')] });

    // Act
    const revised = reviseCommissionConfig(config, { scope: 'all', storeIds: [] }, LATER);

    // Assert
    expect(revised).toMatchObject({ scope: 'all', storeIds: [] });
  });
});

describe('commissionChangedFields', () => {
  it('names the fields that differ, never their values', () => {
    // Arrange
    const before = create({ scope: 'selected', storeIds: [toSnowflake('11')] });
    const after = reviseCommissionConfig(
      before,
      { name: 'Other', value: 999, scope: 'selected', storeIds: [toSnowflake('12')] },
      LATER,
    );

    // Act
    const fields = commissionChangedFields(before, after);

    // Assert
    expect(fields).toEqual(['name', 'value', 'storeIds']);
  });

  it('names nothing for a config that did not change', () => {
    // Arrange
    const config = create();

    // Act and assert
    expect(commissionChangedFields(config, reviseCommissionConfig(config, { value: config.value }, LATER))).toEqual([]);
  });
});
