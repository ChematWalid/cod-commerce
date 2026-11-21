import { SLUG_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { derivedSlug, merchantSlug } from '../../infrastructure/stored-slug';

const HAMZA_ALEF = 'أ';

describe('stored slugs', () => {
  it('normalises an Arabic slug to NFD, as Vendure stores it, whatever its form', () => {
    // Act
    const fromNfc = merchantSlug('حذاء رياضي أحمر'.normalize('NFC'));
    const fromNfd = merchantSlug('حذاء رياضي أحمر'.normalize('NFD'));

    // Assert
    expect(fromNfc).toBe('حذاء-رياضي-أحمر'.normalize('NFD'));
    expect(fromNfd).toBe(fromNfc);
  });

  it('refuses a merchant slug that NFD makes longer than the column', () => {
    // Act
    const storing = () => merchantSlug(HAMZA_ALEF.repeat(SLUG_MAX));

    // Assert
    expect(storing).toThrow(InvalidCatalogInputError);
  });

  it('cuts a slug derived from a long Arabic title to the column', () => {
    // Act
    const slug = derivedSlug(HAMZA_ALEF.repeat(SLUG_MAX));

    // Assert
    expect(slug.length).toBe(SLUG_MAX);
  });

  it('refuses a merchant slug of punctuation only and derives a fallback from such a title', () => {
    // Act / Assert
    expect(() => merchantSlug('???')).toThrow(InvalidCatalogInputError);
    expect(derivedSlug('???')).toBe('product');
  });
});
