import { BRAND_NAME_MAX, TAG_NAME_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { createBrand, createTag, nameKeyOf, renameTag } from '../../domain/taxonomy';
import { at, newId, scopeA, T0 } from '../support/builders';

describe('nameKeyOf', () => {
  it('gives one key to a name whatever its case, spaces or Unicode form', () => {
    // Act
    const keys = [nameKeyOf(' Café '), nameKeyOf('CAFÉ'), nameKeyOf('café')];

    // Assert
    expect(new Set(keys)).toEqual(new Set(['café']));
  });
});

describe('createBrand and createTag', () => {
  it('trims the name and keys it for the unique index', () => {
    // Act
    const brand = createBrand({ id: newId(), scope: scopeA, name: '  Nike  ', now: T0 });

    // Assert
    expect(brand).toMatchObject({ name: 'Nike', nameKey: 'nike', storeId: scopeA.storeId, createdAt: T0 });
  });

  it('refuses a blank, over-long or control-character name', () => {
    // Arrange
    const names = ['   ', 'x'.repeat(BRAND_NAME_MAX + 1), 'a\u0000b'];

    // Act and assert
    for (const name of names) {
      expect(() => createBrand({ id: newId(), scope: scopeA, name, now: T0 })).toThrow(InvalidCatalogInputError);
    }
    expect(() => createTag({ id: newId(), scope: scopeA, name: 'y'.repeat(TAG_NAME_MAX + 1), now: T0 })).toThrow(
      InvalidCatalogInputError,
    );
  });

  it('renames an entry with a new key and update date, keeping its id and creation date', () => {
    // Arrange
    const tag = createTag({ id: newId(), scope: scopeA, name: 'Summer', now: T0 });

    // Act
    const renamed = renameTag(tag, ' WINTER ', at(1));

    // Assert
    expect(renamed).toEqual({ ...tag, name: 'WINTER', nameKey: 'winter', updatedAt: at(1) });
  });
});
