import { MAX_OPTION_GROUPS, MAX_OPTION_VALUES, OPTION_NAME_MAX, OPTION_VALUE_MAX, SKU_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import {
  DuplicateOptionNameError,
  DuplicateOptionValueError,
  InvalidCatalogInputError,
  MatrixTooLargeError,
} from '../../domain/errors';
import { type MatrixInput, planVariantMatrix } from '../../domain/variant-matrix';

const COLOR = { name: 'Color', values: ['Red', 'Blue'] };

function input(overrides: Partial<MatrixInput> = {}): MatrixInput {
  return { productName: 'Product', baseSku: 'TS', basePrice: 2500, groups: [COLOR], existing: [], ...overrides };
}

describe('planVariantMatrix option checks', () => {
  it('refuses more than 100 variants', () => {
    // Arrange: 11 × 10 = 110 combinations.
    const values = (count: number): string[] => Array.from({ length: count }, (_, index) => `v${String(index)}`);
    const groups = [
      { name: 'A', values: values(11) },
      { name: 'B', values: values(10) },
    ];

    // Act
    const plan = (): unknown => planVariantMatrix(input({ groups }));

    // Assert
    expect(plan).toThrow(MatrixTooLargeError);
  });

  it('refuses more option groups or values than the caps', () => {
    // Arrange
    const tooManyGroups = Array.from({ length: MAX_OPTION_GROUPS + 1 }, (_, index) => ({
      name: `G${String(index)}`,
      values: ['x'],
    }));
    const tooManyValues = [
      { name: 'G', values: Array.from({ length: MAX_OPTION_VALUES + 1 }, (_, i) => `v${String(i)}`) },
    ];

    // Act / Assert
    expect(() => planVariantMatrix(input({ groups: tooManyGroups }))).toThrow(MatrixTooLargeError);
    expect(() => planVariantMatrix(input({ groups: tooManyValues }))).toThrow(MatrixTooLargeError);
  });

  it('refuses a duplicate value in one option, whatever its case or Unicode form', () => {
    // Arrange
    const sameCase = [{ name: 'Color', values: ['Red', 'red'] }];
    const sameForm = [{ name: 'Taille', values: ['é', 'é'] }];

    // Act / Assert
    expect(() => planVariantMatrix(input({ groups: sameCase }))).toThrow(DuplicateOptionValueError);
    expect(() => planVariantMatrix(input({ groups: sameForm }))).toThrow(DuplicateOptionValueError);
  });

  it('accepts the same value in two different options', () => {
    // Act
    const plan = planVariantMatrix(
      input({
        groups: [
          { name: 'Front', values: ['Red'] },
          { name: 'Back', values: ['Red'] },
        ],
      }),
    );

    // Assert
    expect(plan.create.map((variant) => variant.name)).toEqual(['Product - Red / Red']);
  });

  it('refuses two options with the same name', () => {
    // Act
    const plan = (): unknown => planVariantMatrix(input({ groups: [COLOR, { name: 'COLOR', values: ['Green'] }] }));

    // Assert
    expect(plan).toThrow(DuplicateOptionNameError);
  });

  it('trims option names and values and matches a live variant whatever its spaces', () => {
    // Act
    const plan = planVariantMatrix(
      input({
        groups: [{ name: ' Color ', values: [' Red', 'Blue '] }],
        existing: [{ id: '11', optionValues: ['Red '], sku: 'TS-1' }],
      }),
    );

    // Assert
    expect(plan.keep).toEqual([{ id: '11', name: 'Product - Red', optionValues: ['Red'] }]);
    expect(plan.create.map((variant) => variant.optionValues)).toEqual([['Blue']]);
  });

  it('refuses a value that differs from another only by spaces', () => {
    // Act
    const plan = (): unknown => planVariantMatrix(input({ groups: [{ name: 'Color', values: ['Red', 'Red '] }] }));

    // Assert
    expect(plan).toThrow(DuplicateOptionValueError);
  });

  it('refuses a blank option name or value', () => {
    // Act / Assert
    expect(() => planVariantMatrix(input({ groups: [{ name: ' ', values: ['Red'] }] }))).toThrow(
      InvalidCatalogInputError,
    );
    expect(() => planVariantMatrix(input({ groups: [{ name: 'Color', values: [''] }] }))).toThrow(
      InvalidCatalogInputError,
    );
  });

  it('refuses an option name or value longer than its cap', () => {
    // Act / Assert
    expect(() =>
      planVariantMatrix(input({ groups: [{ name: 'n'.repeat(OPTION_NAME_MAX + 1), values: ['Red'] }] })),
    ).toThrow(InvalidCatalogInputError);
    expect(() =>
      planVariantMatrix(input({ groups: [{ name: 'Color', values: ['v'.repeat(OPTION_VALUE_MAX + 1)] }] })),
    ).toThrow(InvalidCatalogInputError);
  });

  it('refuses options whose generated skus would be longer than SKU_MAX', () => {
    // Arrange: `<base>-1` is one character too long.
    const baseSku = 'S'.repeat(SKU_MAX - 1);

    // Act
    const plan = (): unknown => planVariantMatrix(input({ baseSku, groups: [COLOR] }));

    // Assert
    expect(plan).toThrow(InvalidCatalogInputError);
  });

  it('refuses an option without values', () => {
    // Act
    const plan = (): unknown => planVariantMatrix(input({ groups: [{ name: 'Color', values: [] }] }));

    // Assert
    expect(plan).toThrow(InvalidCatalogInputError);
  });
});
