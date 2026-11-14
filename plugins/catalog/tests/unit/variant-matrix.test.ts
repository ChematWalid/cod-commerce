import { describe, expect, it } from 'vitest';
import { type ExistingVariant, type MatrixInput, planVariantMatrix } from '../../domain/variant-matrix';

const COLOR = { name: 'Color', values: ['Red', 'Blue'] };
const SIZE = { name: 'Size', values: ['S', 'M'] };

function input(overrides: Partial<MatrixInput> = {}): MatrixInput {
  return { productName: 'Product', baseSku: 'TS', basePrice: 2500, groups: [COLOR, SIZE], existing: [], ...overrides };
}

/** The four variants of Color(Red, Blue) × Size(S, M) as they were first created. */
const FIRST_FOUR: readonly ExistingVariant[] = [
  { id: '11', optionValues: ['Red', 'S'], sku: 'TS-1' },
  { id: '12', optionValues: ['Red', 'M'], sku: 'TS-2' },
  { id: '13', optionValues: ['Blue', 'S'], sku: 'TS-3' },
  { id: '14', optionValues: ['Blue', 'M'], sku: 'TS-4' },
];

describe('planVariantMatrix', () => {
  it('creates four variants named "Product - Red / S" … in matrix order', () => {
    // Act
    const plan = planVariantMatrix(input());

    // Assert
    expect(plan.create.map((variant) => variant.name)).toEqual([
      'Product - Red / S',
      'Product - Red / M',
      'Product - Blue / S',
      'Product - Blue / M',
    ]);
    expect(plan.create.map((variant) => variant.optionValues)).toEqual([
      ['Red', 'S'],
      ['Red', 'M'],
      ['Blue', 'S'],
      ['Blue', 'M'],
    ]);
    expect(plan.keep).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('numbers skus <sku>-1 to <sku>-4 and gives every new variant the product price', () => {
    // Act
    const plan = planVariantMatrix(input());

    // Assert
    expect(plan.create.map((variant) => variant.sku)).toEqual(['TS-1', 'TS-2', 'TS-3', 'TS-4']);
    expect(plan.create.every((variant) => variant.price === 2500)).toBe(true);
  });

  it('leaves the skus empty when the product has no sku', () => {
    // Act
    const plan = planVariantMatrix(input({ baseSku: null }));

    // Assert
    expect(plan.create.map((variant) => variant.sku)).toEqual(['', '', '', '']);
  });

  it('keeps every existing variant when the options did not change', () => {
    // Act
    const plan = planVariantMatrix(input({ existing: FIRST_FOUR }));

    // Assert
    expect(plan.keep.map((variant) => variant.id)).toEqual(['11', '12', '13', '14']);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('keeps an edited variant when another value is added', () => {
    // Arrange
    const edited: ExistingVariant[] = [{ id: '11', optionValues: ['Red', 'S'], sku: 'CUSTOM' }, ...FIRST_FOUR.slice(1)];

    // Act
    const plan = planVariantMatrix(
      input({ groups: [COLOR, { name: 'Size', values: ['S', 'M', 'L'] }], existing: edited }),
    );

    // Assert
    expect(plan.keep.map((variant) => variant.id)).toEqual(['11', '12', '13', '14']);
    expect(plan.create.map((variant) => [variant.name, variant.sku])).toEqual([
      ['Product - Red / L', 'TS-1'],
      ['Product - Blue / L', 'TS-5'],
    ]);
    expect(plan.remove).toEqual([]);
  });

  it('removes only the variants of a removed value', () => {
    // Act
    const plan = planVariantMatrix(input({ groups: [COLOR, { name: 'Size', values: ['S'] }], existing: FIRST_FOUR }));

    // Assert
    expect(plan.keep.map((variant) => variant.id)).toEqual(['11', '13']);
    expect(plan.remove).toEqual(['12', '14']);
    expect(plan.create).toEqual([]);
  });

  it('re-adding a removed value takes the next free sku', () => {
    // Arrange: M was removed, so only Red / S and Blue / S are live; one of them now holds TS-2.
    const live: ExistingVariant[] = [
      { id: '11', optionValues: ['Red', 'S'], sku: 'TS-1' },
      { id: '13', optionValues: ['Blue', 'S'], sku: 'TS-2' },
    ];

    // Act
    const plan = planVariantMatrix(input({ existing: live }));

    // Assert
    expect(plan.keep.map((variant) => variant.id)).toEqual(['11', '13']);
    expect(plan.create.map((variant) => [variant.name, variant.sku])).toEqual([
      ['Product - Red / M', 'TS-3'],
      ['Product - Blue / M', 'TS-4'],
    ]);
    expect(plan.create.map((variant) => variant.sku)).not.toContain('TS-1');
  });

  it('renames kept variants after the product and the new spelling of their values', () => {
    // Act
    const plan = planVariantMatrix(
      input({
        productName: 'Shirt',
        groups: [{ name: 'Color', values: ['red'] }],
        existing: [{ id: '11', optionValues: ['Red'], sku: 'TS-1' }],
      }),
    );

    // Assert
    expect(plan.keep).toEqual([{ id: '11', name: 'Shirt - red', optionValues: ['red'] }]);
  });

  it('makes one default variant without options, carrying the product sku itself', () => {
    // Act
    const plan = planVariantMatrix(input({ groups: [] }));

    // Assert
    expect(plan.create).toEqual([{ name: 'Product', sku: 'TS', price: 2500, optionValues: [] }]);
  });

  it('keeps the default variant while the product has no options', () => {
    // Act
    const plan = planVariantMatrix(input({ groups: [], existing: [{ id: '9', optionValues: [], sku: 'TS' }] }));

    // Assert
    expect(plan.keep).toEqual([{ id: '9', name: 'Product', optionValues: [] }]);
    expect(plan.create).toEqual([]);
  });

  it('replaces the default variant when the first option is added', () => {
    // Act
    const plan = planVariantMatrix(input({ groups: [COLOR], existing: [{ id: '9', optionValues: [], sku: 'TS' }] }));

    // Assert
    expect(plan.remove).toEqual(['9']);
    expect(plan.create.map((variant) => variant.sku)).toEqual(['TS-1', 'TS-2']);
  });

  it('swapping a value never reuses a sku of a variant removed in the same save', () => {
    // Act: M is replaced by L, so Red / M (TS-2) and Blue / M (TS-4) are still live while the plan is made.
    const plan = planVariantMatrix(
      input({ groups: [COLOR, { name: 'Size', values: ['S', 'L'] }], existing: FIRST_FOUR }),
    );

    // Assert
    expect(plan.remove).toEqual(['12', '14']);
    expect(plan.create.map((variant) => [variant.name, variant.sku])).toEqual([
      ['Product - Red / L', 'TS-5'],
      ['Product - Blue / L', 'TS-6'],
    ]);
  });

  it('never gives a new variant the sku of a duplicate variant it removes', () => {
    // Arrange: two live variants share the combination Red; the second is removed.
    const live: ExistingVariant[] = [
      { id: '11', optionValues: ['Red'], sku: 'TS-1' },
      { id: '12', optionValues: ['Red'], sku: 'TS-2' },
    ];

    // Act
    const plan = planVariantMatrix(input({ groups: [COLOR], existing: live }));

    // Assert
    expect(plan.remove).toEqual(['12']);
    expect(plan.create.map((variant) => variant.sku)).toEqual(['TS-3']);
  });

  it('adding an option group replaces every variant', () => {
    // Arrange: live variants of Color alone, one with an edited sku.
    const live: ExistingVariant[] = [
      { id: '11', optionValues: ['Red'], sku: 'CUSTOM' },
      { id: '12', optionValues: ['Blue'], sku: 'TS-2' },
    ];

    // Act
    const plan = planVariantMatrix(input({ groups: [COLOR, { name: 'Size', values: ['S'] }], existing: live }));

    // Assert
    expect(plan.keep).toEqual([]);
    expect(plan.remove).toEqual(['11', '12']);
    expect(plan.create.map((variant) => [variant.name, variant.sku])).toEqual([
      ['Product - Red / S', 'TS-1'],
      ['Product - Blue / S', 'TS-3'],
    ]);
  });

  it('removing an option group replaces every variant', () => {
    // Act
    const plan = planVariantMatrix(input({ groups: [COLOR], existing: FIRST_FOUR }));

    // Assert
    expect(plan.keep).toEqual([]);
    expect(plan.remove).toEqual(['11', '12', '13', '14']);
    expect(plan.create.map((variant) => variant.sku)).toEqual(['TS-5', 'TS-6']);
  });
});
