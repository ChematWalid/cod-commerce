import { describe, expect, it } from 'vitest';
import { ComponentIsPackError, ComponentNotFoundError } from '../../domain/errors';
import { checkComponents } from '../../domain/pack-rules';
import { aProduct } from '../support/builders';

const line = (productId: string, variantId: string | null = null) => ({ productId, variantId, quantity: 1 });

describe('checkComponents (D2202)', () => {
  it('refuses a pack as component', () => {
    // Arrange
    const lines = [
      { line: line('11'), product: aProduct({ id: '11' }) },
      { line: line('12'), product: aProduct({ id: '12', type: 'pack' }) },
    ];

    // Act
    const check = () => checkComponents('20', lines);

    // Assert
    expect(check).toThrow(ComponentIsPackError);
  });

  it('refuses a product of another store', () => {
    // Arrange: the store-scoped read found nothing for 12
    const lines = [
      { line: line('11'), product: aProduct({ id: '11' }) },
      { line: line('12'), product: undefined },
    ];

    // Act
    const check = () => checkComponents('20', lines);

    // Assert
    expect(check).toThrow(ComponentNotFoundError);
  });

  it('refuses the pack itself as one of its components', () => {
    // Arrange
    const lines = [
      { line: line('11'), product: aProduct({ id: '11' }) },
      { line: line('20'), product: aProduct({ id: '20' }) },
    ];

    // Act
    const check = () => checkComponents('20', lines);

    // Assert
    expect(check).toThrow(ComponentIsPackError);
  });

  it('refuses a pinned variant that is not of the component', () => {
    // Arrange
    const lines = [
      { line: line('11', '1201'), product: aProduct({ id: '11' }) },
      { line: line('12'), product: aProduct({ id: '12' }) },
    ];

    // Act
    const check = () => checkComponents('20', lines);

    // Assert
    expect(check).toThrow(ComponentNotFoundError);
  });

  it('answers the products in line order', () => {
    // Arrange
    const first = aProduct({ id: '11' });
    const second = aProduct({ id: '12' });

    // Act
    const products = checkComponents(null, [
      { line: line('11', '1101'), product: first },
      { line: line('12'), product: second },
    ]);

    // Assert
    expect(products).toEqual([first, second]);
  });
});
