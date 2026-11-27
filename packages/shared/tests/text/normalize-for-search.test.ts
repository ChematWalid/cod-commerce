import { describe, expect, it } from 'vitest';
import {
  SEARCH_FORMAT_CHARACTER_RANGES,
  SEARCH_NORMAL_CASES,
  SEARCH_NORMAL_VERSION,
  normalizeForSearch,
  searchQueryTokens,
} from '../../src/index';

const MIN_PARITY_ROWS = 40;
const LAST_CODE_POINT = 0x10ffff;

describe('normalizeForSearch', () => {
  it('ships a parity table large enough to pin the SQL normaliser', () => {
    // Arrange
    const inputs = SEARCH_NORMAL_CASES.map((row) => row.input);

    // Act
    const distinct = new Set(inputs);

    // Assert
    expect(SEARCH_NORMAL_CASES.length).toBeGreaterThanOrEqual(MIN_PARITY_ROWS);
    expect(distinct.size).toBe(inputs.length);
    expect(SEARCH_NORMAL_VERSION).toBe(1);
  });

  it('lists exactly the Unicode format characters in its explicit ranges', () => {
    // Arrange
    const listed = new Set<number>();
    for (const [first, last] of SEARCH_FORMAT_CHARACTER_RANGES) {
      for (let point = first.codePointAt(0) ?? 0; point <= (last.codePointAt(0) ?? 0); point += 1) {
        listed.add(point);
      }
    }

    // Act
    const formatPoints: number[] = [];
    for (let point = 0; point <= LAST_CODE_POINT; point += 1) {
      if (/\p{Cf}/u.test(String.fromCodePoint(point))) formatPoints.push(point);
    }

    // Assert
    expect([...listed].sort((a, b) => a - b)).toEqual(formatPoints);
  });

  it.each(SEARCH_NORMAL_CASES)('normalises $input to $expected', ({ input, expected }) => {
    // Act
    const normalised = normalizeForSearch(input);

    // Assert
    expect(normalised).toBe(expected);
  });

  it('is idempotent on every parity row', () => {
    // Arrange
    const outputs = SEARCH_NORMAL_CASES.map((row) => normalizeForSearch(row.input));

    // Act
    const again = outputs.map((output) => normalizeForSearch(output));

    // Assert
    expect(again).toEqual(outputs);
  });

  it('matches a buyer query typed without hamza, harakat or accents', () => {
    // Arrange
    const title = 'قُفْطَانٌ مُؤَطَّر - Robe brodée';
    const query = 'قفطان موطر robe brodee';

    // Act
    const normalisedTitle = normalizeForSearch(title);

    // Assert
    for (const word of normalizeForSearch(query).split(' ')) {
      expect(normalisedTitle).toContain(word);
    }
  });
});

describe('searchQueryTokens', () => {
  it('strips the definite article from words longer than four letters', () => {
    // Act
    const tokens = searchQueryTokens('القفطان');

    // Assert
    expect(tokens).toEqual(['قفطان']);
  });

  it('keeps the definite article on words of four letters or fewer', () => {
    // Act
    const tokens = searchQueryTokens('الة');

    // Assert
    expect(tokens).toEqual(['اله']);
  });

  it('splits a mixed query into normalised words and drops empty ones', () => {
    // Act
    const tokens = searchQueryTokens('  الْقُفْطَان‏  Brodé ٢٠٢٥ ');

    // Assert
    expect(tokens).toEqual(['قفطان', 'brode', '2025']);
  });

  it('returns no tokens for a query of only marks and spaces', () => {
    // Act
    const tokens = searchQueryTokens(' ​َـ ');

    // Assert
    expect(tokens).toEqual([]);
  });
});
