import { normalForMatch } from '../collections/text-normal';

/** Version of the search normal form; a change to `normalizeForSearch` bumps it and rebuilds the stored `search_text`. */
export const SEARCH_NORMAL_VERSION = 1;

/** Hamza seats buyers drop when they type: `ؤ` reads as `و`, `ئ` as `ي` (ADR 0014). */
const HAMZA_SEAT_FOLDS: readonly (readonly [RegExp, string])[] = [
  [/ؤ/gu, 'و'],
  [/ئ/gu, 'ي'],
];

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;
const ASCII_ZERO = 0x30;
const ARABIC_INDIC_DIGIT = /[٠-٩]/gu;
const EASTERN_ARABIC_INDIC_DIGIT = /[۰-۹]/gu;

/**
 * Latin letters with no canonical decomposition that the Postgres `unaccent` dictionary still maps; listed so the TS and
 * SQL normalisers agree on them.
 */
const LATIN_LETTER_FOLDS: readonly (readonly [RegExp, string])[] = [
  [/ø/gu, 'o'],
  [/œ/gu, 'oe'],
  [/æ/gu, 'ae'],
  [/ł/gu, 'l'],
  [/ı/gu, 'i'],
  [/[đð]/gu, 'd'],
  [/þ/gu, 'th'],
  [/ħ/gu, 'h'],
];

/**
 * Combining diacritical marks used by Latin script. Only this block is stripped after NFD, so Arabic letters that
 * decompose (a hamza above, for instance) recompose untouched.
 */
const LATIN_COMBINING_MARKS = /[̀-ͯ]/gu;

/** Article `ال` stripped from query words longer than this many letters (ADR 0014). */
const ARTICLE_STRIP_MIN_LETTERS = 5;
const ARABIC_ARTICLE = 'ال';

function applyFolds(text: string, folds: readonly (readonly [RegExp, string])[]): string {
  return folds.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function toAsciiDigits(text: string): string {
  const fromZero = (zero: number) => (digit: string) => String.fromCharCode(ASCII_ZERO + (digit.charCodeAt(0) - zero));
  return text
    .replace(ARABIC_INDIC_DIGIT, fromZero(ARABIC_INDIC_ZERO))
    .replace(EASTERN_ARABIC_INDIC_DIGIT, fromZero(EASTERN_ARABIC_INDIC_ZERO));
}

function unaccentLatin(text: string): string {
  return applyFolds(text, LATIN_LETTER_FOLDS).normalize('NFD').replace(LATIN_COMBINING_MARKS, '').normalize('NFC');
}

/**
 * The form product text and buyer queries are compared in by the storefront search (ADR 0014): the collection-rule
 * normal form (`normalForMatch`: NFKC, lower case, harakat, tatweel and format characters removed, alef/yaa/taa folds,
 * whitespace collapsed), plus `ؤ`→`و`, `ئ`→`ي`, Arabic-Indic digits as ASCII, and Latin accents removed. It must stay
 * equal to the SQL normaliser on every row of `SEARCH_NORMAL_CASES`.
 */
export function normalizeForSearch(input: string): string {
  return unaccentLatin(toAsciiDigits(applyFolds(normalForMatch(input), HAMZA_SEAT_FOLDS)));
}

function stripArticle(word: string): string {
  const letterCount = Array.from(word).length;
  if (letterCount < ARTICLE_STRIP_MIN_LETTERS || !word.startsWith(ARABIC_ARTICLE)) {
    return word;
  }
  return word.slice(ARABIC_ARTICLE.length);
}

/**
 * The words of a buyer query in search normal form, with the article `ال` stripped from words longer than four letters
 * (so `القفطان` finds `قفطان`, while a short word such as `الة` keeps it). Empty words are dropped.
 */
export function searchQueryTokens(query: string): string[] {
  return normalizeForSearch(query)
    .split(' ')
    .filter((word) => word.length > 0)
    .map(stripArticle);
}
