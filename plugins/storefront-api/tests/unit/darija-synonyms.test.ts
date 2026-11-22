import { normalizeForSearch } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { SEARCH_SYNONYM_MAX_LENGTH } from '../../domain/constants';
import { DARIJA_SYNONYMS } from '../../domain/darija-synonyms';

const MIN_SEED_PAIRS = 30;

describe('DARIJA_SYNONYMS', () => {
  it(`seeds at least ${String(MIN_SEED_PAIRS)} distinct pairs`, () => {
    // Act
    const keys = new Set(DARIJA_SYNONYMS.map(({ term, expansion }) => `${term}|${expansion}`));

    // Assert
    expect(DARIJA_SYNONYMS.length).toBeGreaterThanOrEqual(MIN_SEED_PAIRS);
    expect(keys.size).toBe(DARIJA_SYNONYMS.length);
  });

  it('stores both sides in search normal form, so a query word meets them as typed', () => {
    // Assert
    for (const { term, expansion } of DARIJA_SYNONYMS) {
      expect(normalizeForSearch(term)).toBe(term);
      expect(normalizeForSearch(expansion)).toBe(expansion);
      expect(term.length).toBeLessThanOrEqual(SEARCH_SYNONYM_MAX_LENGTH);
      expect(expansion.length).toBeLessThanOrEqual(SEARCH_SYNONYM_MAX_LENGTH);
    }
  });

  it('pairs the Latin words buyers type with the Arabic-script word, shadda and taa marbuta folded', () => {
    // Assert
    expect(DARIJA_SYNONYMS).toEqual(
      expect.arrayContaining([
        { term: 'sabbat', expansion: 'سباط' },
        { term: 'jellaba', expansion: 'جلابه' },
        { term: 'kaftan', expansion: 'قفطان' },
        { term: 'tricot', expansion: 'تريكو' },
        { term: 'chlaka', expansion: 'شلاكه' },
      ]),
    );
  });
});
