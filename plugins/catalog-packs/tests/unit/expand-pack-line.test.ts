import { describe, expect, it } from 'vitest';
import { ComponentNotFoundError } from '../../domain/errors';
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
const pack: ExpandablePack = { id: PACK_ID, components: [shirtLine, capLine] };

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
    const three = {
      id: PACK_ID,
      components: ['11', '12', '13'].map((productId) => ({ productId, variantId: null, quantity: 1 })),
    };
    const equal = ['11', '12', '13'].map((productId) => ({ productId, variantId: `${productId}01`, unitPrice: 500 }));

    // Act
    const { children } = expandPackLine({ line: aLine({ unitPrice: 100 }), pack: three, componentPrices: equal });

    // Assert
    expect(children.map((child) => child.lineTotal)).toEqual([34, 33, 33]);
  });

  it('children sum to the parent total for 1..99 units', () => {
    // Arrange: prices that never divide evenly
    const odd = [
      { productId: '11', variantId: '1101', unitPrice: 1333 },
      { productId: '12', variantId: '1201', unitPrice: 2777 },
    ];

    for (let quantity = 1; quantity <= 99; quantity += 1) {
      // Act
      const { children } = expandPackLine({ line: aLine({ quantity, unitPrice: 3697 }), pack, componentPrices: odd });

      // Assert
      const total = children.reduce((sum, child) => sum + child.lineTotal, 0);
      expect(total).toBe(3697 * quantity);
    }
  });

  it('child quantity is component quantity times line quantity', () => {
    // Arrange
    const doubled = { id: PACK_ID, components: [{ ...shirtLine, quantity: 2 }, capLine] };

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
    const pinned = { id: PACK_ID, components: [{ ...shirtLine, variantId: '1101' }, capLine] };

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

    // Assert
    expect(children.reduce((sum, child) => sum + child.lineTotal, 0)).toBe(max * 99);
  });
});
