import { describe, expect, it } from 'vitest';
import { isListed, type ProjectedProduct, projectionRowOf } from '../../domain/projection-row';

const CREATED = new Date('2026-11-01T10:00:00.000Z');

const aProduct = (overrides: Partial<ProjectedProduct> = {}): ProjectedProduct => ({
  id: '42',
  slug: 'kaftan-rouge',
  title: 'Kaftan Rouge',
  status: 'active',
  price: 5000,
  oldPrice: null,
  variants: [{ price: 5000, oldPrice: null }],
  imagePath: 'preview/kaftan.jpg',
  createdAt: CREATED,
  ...overrides,
});

describe('projectionRowOf', () => {
  it('stores no row for a draft, which no public context shows', () => {
    // Act
    const row = projectionRowOf(aProduct({ status: 'draft' }), false, 'keep');

    // Assert
    expect(row).toBeUndefined();
  });

  it('keeps a hidden product unlisted', () => {
    // Act
    const row = projectionRowOf(aProduct({ status: 'hidden' }), false, 'keep');

    // Assert
    expect(row).toMatchObject({ visible: false, listed: false });
  });

  it('leaves a sold-out product out of the lists of a store that hides sold-out products', () => {
    // Act
    const row = projectionRowOf(aProduct(), true, 'hide');

    // Assert
    expect(row).toMatchObject({ visible: true, soldOut: true, listed: false });
  });

  it('lists a sold-out product, marked sold out, in a store that keeps them', () => {
    // Act
    const row = projectionRowOf(aProduct(), true, 'keep');

    // Assert
    expect(row).toMatchObject({ visible: true, soldOut: true, listed: true });
  });

  it('prices the card at the lowest visible variant price, with that variant old price when above it', () => {
    // Arrange
    const product = aProduct({
      price: 9000,
      variants: [
        { price: 7000, oldPrice: 8000 },
        { price: 6000, oldPrice: 7500 },
        { price: 6500, oldPrice: null },
      ],
    });

    // Act
    const row = projectionRowOf(product, false, 'keep');

    // Assert
    expect(row).toMatchObject({ price: 6000, oldPrice: 7500 });
  });

  it('uses the product price when no variant is visible and drops an old price that is not above the price', () => {
    // Act
    const row = projectionRowOf(aProduct({ price: 3000, oldPrice: 2500, variants: [] }), false, 'keep');

    // Assert
    expect(row).toMatchObject({ price: 3000, oldPrice: null });
  });

  it('writes the name normalised for search and keeps the product fields a card shows', () => {
    // Act
    const row = projectionRowOf(aProduct({ title: 'Ḱaftan  ROUGE' }), false, 'keep');

    // Assert
    expect(row).toEqual({
      productId: '42',
      slug: 'kaftan-rouge',
      name: 'Ḱaftan  ROUGE',
      searchText: 'kaftan rouge',
      price: 5000,
      oldPrice: null,
      imagePath: 'preview/kaftan.jpg',
      visible: true,
      soldOut: false,
      listed: true,
      createdAt: CREATED,
    });
  });
});

describe('isListed', () => {
  it.each([
    [true, false, 'hide', true],
    [true, true, 'hide', false],
    [true, true, 'keep', true],
    [false, false, 'keep', false],
  ] as const)('visible %s, sold out %s, behaviour %s → listed %s', (visible, soldOut, behaviour, listed) => {
    // Act / Assert
    expect(isListed(visible, soldOut, behaviour)).toBe(listed);
  });
});
