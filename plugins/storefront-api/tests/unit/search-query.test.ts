import { STOREFRONT_SEARCH_MAX_QUERY } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { STOREFRONT_SEARCH_MAX_VARIANTS } from '../../domain/constants';
import { queryVariants, searchQueryOf, synonymLookupTerms } from '../../domain/search-query';

/** U+200F, which a phone keyboard slips into Arabic text. */
const RIGHT_TO_LEFT_MARK = String.fromCodePoint(0x200f);

describe('searchQueryOf', () => {
  it.each([undefined, '', ' ', 'a', ' x ', ['kaftan'], { q: 'kaftan' }, 12])(
    'reads %j as no query: too short or not one string',
    (raw) => {
      // Act / Assert
      expect(searchQueryOf(raw)).toBeUndefined();
    },
  );

  it('normalises the words and strips the article from words longer than four letters', () => {
    // Act
    const query = searchQueryOf('  القُفطان   الأحمر ');

    // Assert
    expect(query).toEqual({ text: 'قفطان احمر', tokens: ['قفطان', 'احمر'] });
  });

  it(`reads at most ${String(STOREFRONT_SEARCH_MAX_QUERY)} characters of a huge query`, () => {
    // Act
    const query = searchQueryOf(`robe ${'z'.repeat(495)}`);

    // Assert
    expect(Array.from(query?.text ?? '')).toHaveLength(STOREFRONT_SEARCH_MAX_QUERY);
    expect(query?.tokens[0]).toBe('robe');
  });

  it('drops invisible right-to-left marks, so a mark-only query is too short', () => {
    // Act / Assert
    expect(searchQueryOf(RIGHT_TO_LEFT_MARK.repeat(3))).toBeUndefined();
  });
});

describe('queryVariants', () => {
  it('answers the query first, then each word swapped for its synonyms, in both directions', () => {
    // Arrange
    const query = { text: 'sabbat ابيض', tokens: ['sabbat', 'ابيض'] };
    const synonyms = [
      { term: 'sabbat', expansion: 'سباط' },
      { term: 'blanc', expansion: 'ابيض' },
    ];

    // Act
    const variants = queryVariants(query, synonyms);

    // Assert
    expect(variants).toEqual(['sabbat ابيض', 'سباط ابيض', 'sabbat blanc']);
  });

  it('expands a whole multi-word query that is a term, and never repeats a variant', () => {
    // Arrange
    const query = { text: 'haut parleur', tokens: ['haut', 'parleur'] };
    const synonyms = [
      { term: 'haut parleur', expansion: 'مكبر صوت' },
      { term: 'haut parleur', expansion: 'مكبر صوت' },
    ];

    // Act / Assert
    expect(queryVariants(query, synonyms)).toEqual(['haut parleur', 'مكبر صوت']);
  });

  it(`keeps at most ${String(STOREFRONT_SEARCH_MAX_VARIANTS)} variants`, () => {
    // Arrange
    const query = { text: 'kaftan', tokens: ['kaftan'] };
    const synonyms = Array.from({ length: 20 }, (_, index) => ({ term: 'kaftan', expansion: `k${String(index)}` }));

    // Act
    const variants = queryVariants(query, synonyms);

    // Assert
    expect(variants).toHaveLength(STOREFRONT_SEARCH_MAX_VARIANTS);
    expect(variants[0]).toBe('kaftan');
  });
});

describe('synonymLookupTerms', () => {
  it('names each word once and the whole query', () => {
    // Act / Assert
    expect(synonymLookupTerms({ text: 'robe robe rouge', tokens: ['robe', 'robe', 'rouge'] })).toEqual([
      'robe',
      'rouge',
      'robe robe rouge',
    ]);
  });
});
