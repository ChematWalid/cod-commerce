import { PRODUCT_TITLE_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { ProductTitle } from '../../domain/product-title';

describe('ProductTitle', () => {
  it('trims the surrounding whitespace', () => {
    // Act
    const title = ProductTitle.create('  حذاء رياضي أحمر  ');

    // Assert
    expect(title.value).toBe('حذاء رياضي أحمر');
  });

  it('keeps an Arabic direction mark', () => {
    // Act
    const title = ProductTitle.create('‏حذاء');

    // Assert
    expect(title.value).toBe('‏حذاء');
  });

  it('accepts the maximum length and refuses one character more', () => {
    // Act / Assert
    expect(ProductTitle.create('a'.repeat(PRODUCT_TITLE_MAX)).value).toHaveLength(PRODUCT_TITLE_MAX);
    expect(() => ProductTitle.create('a'.repeat(PRODUCT_TITLE_MAX + 1))).toThrow(InvalidCatalogInputError);
  });

  it.each([
    ['a blank title', ' \t '],
    ['a NUL', 'Shoe\u0000'],
    ['a line break', 'Red\nShoe'],
    ['a bidi isolate', 'Shoe⁦x'],
  ])('refuses %s', (_label, raw) => {
    // Act
    const create = (): ProductTitle => ProductTitle.create(raw);

    // Assert
    expect(create).toThrow(InvalidCatalogInputError);
  });

  it('restores a stored title without validating it again', () => {
    // Act
    const title = ProductTitle.restore('legacy‮');

    // Assert
    expect(title.value).toBe('legacy‮');
  });
});
