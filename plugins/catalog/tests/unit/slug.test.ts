import { SLUG_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { Slug } from '../../domain/slug';

describe('Slug', () => {
  it('trims and keeps an Arabic slug', () => {
    // Act
    const slug = Slug.create('  حذاء-رياضي-أحمر ');

    // Assert
    expect(slug.value).toBe('حذاء-رياضي-أحمر');
  });

  it('accepts the maximum length and refuses one character more', () => {
    // Act / Assert
    expect(Slug.create('a'.repeat(SLUG_MAX)).value).toHaveLength(SLUG_MAX);
    expect(() => Slug.create('a'.repeat(SLUG_MAX + 1))).toThrow(InvalidCatalogInputError);
  });

  it.each([
    ['a blank slug', '   '],
    ['a NUL', 'red\u0000shoe'],
    ['a line break', 'red\nshoe'],
    ['a bidi override', 'red‮shoe'],
  ])('refuses %s', (_label, raw) => {
    // Act
    const create = (): Slug => Slug.create(raw);

    // Assert
    expect(create).toThrow(InvalidCatalogInputError);
  });
});
