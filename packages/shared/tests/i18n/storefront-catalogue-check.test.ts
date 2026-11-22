import { describe, expect, it } from 'vitest';
import { checkStorefrontCatalogues } from '../../scripts/i18n/check-storefront-catalogues';
import { STOREFRONT_CATALOGUES } from '../../src/storefront/i18n/catalogue';

/** The six Arabic plural forms, filled. */
const ARABIC_FORMS = { zero: 'ص', one: 'و', two: 'ا', few: 'ق', many: 'ك', other: 'غ' };

describe('storefront catalogue check (D3212)', () => {
  it('finds no gap in the shipped ar, fr and en catalogues', () => {
    // Act
    const problems = checkStorefrontCatalogues(STOREFRONT_CATALOGUES);
    if (problems.length > 0) console.error(problems);
    // Assert
    expect(problems).toEqual([]);
  });

  it('reports a key one language lacks', () => {
    // Act
    const problems = checkStorefrontCatalogues({ en: { a: 'A', b: 'B' }, fr: { a: 'A' }, ar: { a: 'أ', b: 'ب' } });
    // Assert
    expect(problems).toContainEqual({ locale: 'fr', key: 'b', kind: 'missing' });
  });

  it('reports a key only one language has', () => {
    // Act
    const problems = checkStorefrontCatalogues({ en: { a: 'A' }, fr: { a: 'A', extra: 'X' }, ar: { a: 'أ' } });
    // Assert
    expect(problems).toContainEqual({ locale: 'en', key: 'extra', kind: 'missing' });
  });

  it('reports an empty value', () => {
    // Act
    const problems = checkStorefrontCatalogues({ en: { a: ' ' }, fr: { a: 'A' }, ar: { a: 'أ' } });
    // Assert
    expect(problems).toContainEqual({ locale: 'en', key: 'a', kind: 'empty' });
  });

  it('reports an Arabic plural that lacks one of the six forms', () => {
    // Arrange
    const fiveForms: Record<string, string> = { ...ARABIC_FORMS };
    delete fiveForms['few'];
    const plural = { one: 'one', other: 'other' };
    // Act
    const problems = checkStorefrontCatalogues({ en: { n: plural }, fr: { n: plural }, ar: { n: fiveForms } });
    // Assert
    expect(problems).toContainEqual({ locale: 'ar', key: 'n', kind: 'plural' });
  });

  it('reports a plural without an "other" form', () => {
    // Act
    const problems = checkStorefrontCatalogues({
      en: { n: { one: 'x' } },
      fr: { n: { one: 'x', other: 'y' } },
      ar: { n: ARABIC_FORMS },
    });
    // Assert
    expect(problems).toContainEqual({ locale: 'en', key: 'n', kind: 'plural' });
  });

  it('reports a translation whose placeholders differ from the English text', () => {
    // Act
    const problems = checkStorefrontCatalogues({
      en: { q: 'No {query}' },
      fr: { q: 'Aucun {requete}' },
      ar: { q: 'لا {query}' },
    });
    // Assert
    expect(problems).toContainEqual({ locale: 'fr', key: 'q', kind: 'placeholder' });
  });

  it('reports a value that is neither text nor plural forms', () => {
    // Act
    const problems = checkStorefrontCatalogues({ en: { a: 3 }, fr: { a: 'A' }, ar: { a: 'أ' } });
    // Assert
    expect(problems).toContainEqual({ locale: 'en', key: 'a', kind: 'invalid' });
  });
});
