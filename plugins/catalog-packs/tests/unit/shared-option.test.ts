import { describe, expect, it } from 'vitest';
import { NoCommonValueError, SharedOptionMissingError } from '../../domain/errors';
import { sharedOptionMatrix } from '../../domain/shared-option';
import { aProduct, aSizedProduct } from '../support/builders';

describe('sharedOptionMatrix (D2202)', () => {
  it("Size S/M/L and Size M/L/XL share M and L in the first component's order", () => {
    // Arrange
    const shirt = aSizedProduct('11', 'Size', ['S', 'M', 'L']);
    const trousers = aSizedProduct('12', 'Size', ['XL', 'L', 'M']);

    // Act
    const matrix = sharedOptionMatrix('Size', [shirt, trousers]);

    // Assert
    expect(matrix.values).toEqual(['M', 'L']);
    expect(matrix.variantsByValue.get('M')).toEqual(['1102', '1203']);
    expect(matrix.variantsByValue.get('L')).toEqual(['1103', '1202']);
  });

  it("matches 'size' and 'Size ' as one option", () => {
    // Arrange
    const shirt = aSizedProduct('11', 'size', ['M']);
    const trousers = aSizedProduct('12', 'Size ', ['m']);

    // Act
    const matrix = sharedOptionMatrix(' SIZE', [shirt, trousers]);

    // Assert
    expect(matrix.values).toEqual(['M']);
  });

  it('refuses a component without Size', () => {
    // Arrange
    const shirt = aSizedProduct('11', 'Size', ['M']);
    const plain = aProduct({ id: '12' });

    // Act
    const build = () => sharedOptionMatrix('Size', [shirt, plain]);

    // Assert
    expect(build).toThrow(SharedOptionMissingError);
  });

  it('refuses a component with a second option group', () => {
    // Arrange
    const shirt = aSizedProduct('11', 'Size', ['M']);
    const coloured = aProduct({
      id: '12',
      optionGroups: [
        { name: 'Size', values: ['M'] },
        { name: 'Colour', values: ['Red'] },
      ],
      variants: [{ id: '1201', price: 1000, optionValues: ['M', 'Red'] }],
    });

    // Act
    const build = () => sharedOptionMatrix('Size', [shirt, coloured]);

    // Assert
    expect(build).toThrow(SharedOptionMissingError);
  });

  it('refuses when no value is common', () => {
    // Arrange
    const shirt = aSizedProduct('11', 'Size', ['S']);
    const trousers = aSizedProduct('12', 'Size', ['XL']);

    // Act
    const build = () => sharedOptionMatrix('Size', [shirt, trousers]);

    // Assert
    expect(build).toThrow(NoCommonValueError);
  });

  it('leaves out a value a component lists but sells no variant of', () => {
    // Arrange
    const shirt = aSizedProduct('11', 'Size', ['M', 'L']);
    const trousers = {
      ...aSizedProduct('12', 'Size', ['M', 'L']),
      variants: [{ id: '1202', price: 1, optionValues: ['L'] }],
    };

    // Act
    const matrix = sharedOptionMatrix('Size', [shirt, trousers]);

    // Assert
    expect(matrix.values).toEqual(['L']);
  });
});
