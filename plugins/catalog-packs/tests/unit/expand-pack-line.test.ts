import { describe, expect, it } from 'vitest';
import { ComponentNotFoundError, InvalidPackInputError } from '../../domain/errors';
import {
  type ComponentVariantPrice,
  type ExpandablePack,
  expandPackLine,
  type PackLine,
} from '../../domain/expand-pack-line';
import type { PackComponentLine } from '../../domain/pack';

const PACK_ID = '7000000000000000101';

/** A pack of product 11 (×1) and product 12 (×1), no variant pinned. */
const shirtLine: PackComponentLine = { productId: '11', variantId: null, quantity: 1 };
const capLine: PackComponentLine = { productId: '12', variantId: null, quantity: 1 };
const pack: ExpandablePack = { id: PACK_ID, packVariantMode: 'per_component', components: [shirtLine, capLine] };

/** One default variant per component: 1101 at 1 500 DZD, 1201 at 2 000 DZD. */
const prices: readonly ComponentVariantPrice[] = [
  { productId: '11', variantId: '1101', unitPrice: 1500 },
  { productId: '12', variantId: '1201', unitPrice: 2000 },
];

const aLine = (overrides: Partial<PackLine> = {}): PackLine => ({
  itemId: 'line-1',
  productId: '30',
  variantId: '3001',
  quantity: 1,
  unitPrice: 3150,
  ...overrides,
});

describe('expandPackLine (D2205)', () => {
  it('splits 3 150 over components priced 1 500 and 2 000 as 1 350 and 1 800', () => {
    // Act
    const { parent, children } = expandPackLine({ line: aLine(), pack, componentPrices: prices });

    // Assert
    expect(parent).toEqual({ ...aLine(), bundleId: PACK_ID });
    expect(children).toEqual([
      {
        productId: '11',
        variantId: '1101',
        quantity: 1,
        unitPrice: 1500,
        lineTotal: 1350,
        bundleId: PACK_ID,
        packParentItemId: 'line-1',
      },
      {
        productId: '12',
        variantId: '1201',
        quantity: 1,
        unitPrice: 2000,
        lineTotal: 1800,
        bundleId: PACK_ID,
        packParentItemId: 'line-1',
      },
    ]);
  });

  it('gives the rounding remainder to the first child', () => {
    // Arrange: 100 over three equal components is 33 each, 1 left over
    const three: ExpandablePack = {
      id: PACK_ID,
      packVariantMode: 'per_component',
      components: ['11', '12', '13'].map((productId) => ({ productId, variantId: null, quantity: 1 })),
    };
    const equal = ['11', '12', '13'].map((productId) => ({ productId, variantId: `${productId}01`, unitPrice: 500 }));

    // Act
    const { children } = expandPackLine({ line: aLine({ unitPrice: 100 }), pack: three, componentPrices: equal });

    // Assert
    expect(children.map((child) => child.lineTotal)).toEqual([34, 33, 33]);
  });

  it('splits each total of 1..99 units as the floored proportional share, the remainder to the first child', () => {
    // Arrange: prices that never divide evenly
    const odd = [
      { productId: '11', variantId: '1101', unitPrice: 1333 },
      { productId: '12', variantId: '1201', unitPrice: 2777 },
    ];

    for (let quantity = 1; quantity <= 99; quantity += 1) {
      // Act
      const { children } = expandPackLine({ line: aLine({ quantity, unitPrice: 3697 }), pack, componentPrices: odd });

      // Assert
      const [first, second] = expectedShares(3697n * BigInt(quantity), [1333n, 2777n]);
      expect(children.map((child) => child.lineTotal)).toEqual([first, second]);
      expect(children.every((child) => child.lineTotal >= 0)).toBe(true);
    }
  });

  it('child quantity is component quantity times line quantity', () => {
    // Arrange
    const doubled: ExpandablePack = { ...pack, components: [{ ...shirtLine, quantity: 2 }, capLine] };

    // Act
    const { children } = expandPackLine({ line: aLine({ quantity: 3 }), pack: doubled, componentPrices: prices });

    // Assert
    expect(children.map((child) => child.quantity)).toEqual([6, 3]);
  });

  it('uses the chosen variant per component in per_component mode', () => {
    // Arrange: product 11 sells two sizes; the buyer chose 1102
    const sized = [...prices, { productId: '11', variantId: '1102', unitPrice: 1500 }];

    // Act
    const { children } = expandPackLine({
      line: aLine(),
      pack,
      componentPrices: sized,
      chosenVariants: new Map([['11', '1102']]),
    });

    // Assert
    expect(children.map((child) => child.variantId)).toEqual(['1102', '1201']);
  });

  it('refuses a chosen variant that is not of the component', () => {
    // Act
    const expand = () =>
      expandPackLine({ line: aLine(), pack, componentPrices: prices, chosenVariants: new Map([['11', '1201']]) });

    // Assert
    expect(expand).toThrow(ComponentNotFoundError);
  });

  it('keeps a pinned variant whatever was chosen', () => {
    // Arrange
    const pinned: ExpandablePack = { ...pack, components: [{ ...shirtLine, variantId: '1101' }, capLine] };

    // Act
    const { children } = expandPackLine({
      line: aLine(),
      pack: pinned,
      componentPrices: [...prices, { productId: '11', variantId: '1102', unitPrice: 1500 }],
      chosenVariants: new Map([['11', '1102']]),
    });

    // Assert
    expect(children[0]?.variantId).toBe('1101');
  });

  it('refuses a component with several variants and none chosen', () => {
    // Act
    const expand = () =>
      expandPackLine({
        line: aLine(),
        pack,
        componentPrices: [...prices, { productId: '11', variantId: '1102', unitPrice: 1500 }],
      });

    // Assert
    expect(expand).toThrow(ComponentNotFoundError);
  });

  it('gives the whole total to the first child when every component is free', () => {
    // Act
    const { children } = expandPackLine({
      line: aLine({ unitPrice: 500 }),
      pack,
      componentPrices: prices.map((price) => ({ ...price, unitPrice: 0 })),
    });

    // Assert
    expect(children.map((child) => child.lineTotal)).toEqual([500, 0]);
  });

  it('stays exact at the largest prices and quantities', () => {
    // Arrange: int-max prices and 99 units would lose precision in a double product
    const max = 2_147_483_647;
    const big = [
      { productId: '11', variantId: '1101', unitPrice: max },
      { productId: '12', variantId: '1201', unitPrice: max - 1 },
    ];

    // Act
    const { children } = expandPackLine({ line: aLine({ quantity: 99, unitPrice: max }), pack, componentPrices: big });

    // Assert: each share equals the one computed independently in BigInt
    const total = BigInt(max) * 99n;
    expect(children.map((child) => child.lineTotal)).toEqual(expectedShares(total, [BigInt(max), BigInt(max - 1)]));
  });

  it('refuses a line whose total is past the exact integer range', () => {
    // Act
    const expand = () =>
      expandPackLine({
        line: aLine({ quantity: 2, unitPrice: Number.MAX_SAFE_INTEGER }),
        pack,
        componentPrices: prices,
      });

    // Assert
    expect(expand).toThrow(InvalidPackInputError);
  });

  it.each([
    ['a fractional component price', { unitPrice: 1500.5 }],
    ['a negative component price', { unitPrice: -1 }],
  ])('refuses %s as malformed input', (_name, override) => {
    // Arrange
    const broken = [{ ...prices[0], ...override } as ComponentVariantPrice, prices[1] as ComponentVariantPrice];

    // Act
    const expand = () => expandPackLine({ line: aLine(), pack, componentPrices: broken });

    // Assert
    expect(expand).toThrow(InvalidPackInputError);
  });

  it.each([0, -1, 1.5])('refuses a component quantity of %s as malformed input', (quantity) => {
    // Arrange
    const broken: ExpandablePack = { ...pack, components: [{ ...shirtLine, quantity }, capLine] };

    // Act
    const expand = () => expandPackLine({ line: aLine(), pack: broken, componentPrices: prices });

    // Assert
    expect(expand).toThrow(InvalidPackInputError);
  });
});

describe('expandPackLine in shared_option mode (D2202, D2243)', () => {
  /** Pack variant 3001 is size M, 3002 size L; both components sell M and L. */
  const shared: ExpandablePack = {
    ...pack,
    packVariantMode: 'shared_option',
    sharedValues: new Map([
      ['3001', 'M'],
      ['3002', 'L'],
    ]),
  };
  const sized: readonly ComponentVariantPrice[] = [
    { productId: '11', variantId: '1101', unitPrice: 1500, sharedValue: 'M' },
    { productId: '11', variantId: '1102', unitPrice: 1600, sharedValue: 'L' },
    { productId: '12', variantId: '1201', unitPrice: 2000, sharedValue: 'm ' },
    { productId: '12', variantId: '1202', unitPrice: 2100, sharedValue: 'L' },
  ];

  it('ships the variant of each component carrying the ordered pack variant value', () => {
    // Act
    const medium = expandPackLine({ line: aLine({ variantId: '3001' }), pack: shared, componentPrices: sized });
    const large = expandPackLine({ line: aLine({ variantId: '3002' }), pack: shared, componentPrices: sized });

    // Assert
    expect(medium.children.map((child) => child.variantId)).toEqual(['1101', '1201']);
    expect(large.children.map((child) => child.variantId)).toEqual(['1102', '1202']);
  });

  it('follows the pack variant, not a buyer choice that disagrees with it', () => {
    // Act
    const { children } = expandPackLine({
      line: aLine({ variantId: '3001' }),
      pack: shared,
      componentPrices: sized,
      chosenVariants: new Map([['11', '1102']]),
    });

    // Assert
    expect(children[0]?.variantId).toBe('1101');
  });

  it('refuses a pack variant with no shared value, or a value a component does not sell', () => {
    // Act
    const unknownVariant = () =>
      expandPackLine({ line: aLine({ variantId: '3999' }), pack: shared, componentPrices: sized });
    const unsold = () =>
      expandPackLine({
        line: aLine({ variantId: '3002' }),
        pack: shared,
        componentPrices: sized.filter((price) => price.variantId !== '1202'),
      });

    // Assert
    expect(unknownVariant).toThrow(ComponentNotFoundError);
    expect(unsold).toThrow(ComponentNotFoundError);
  });
});

/** The floored share of each weight, the remainder added to the first, computed apart from the code under test. */
function expectedShares(total: bigint, weights: readonly bigint[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0n);
  const shares = weights.map((weight) => (total * weight) / sum);
  const remainder = total - shares.reduce((acc, share) => acc + share, 0n);
  expect(remainder >= 0n && remainder < BigInt(weights.length)).toBe(true);
  return shares.map((share, index) => Number(index === 0 ? share + remainder : share));
}
