/** One row of the search normaliser parity table: `normalizeForSearch(input)` and the SQL normaliser both give `expected`. */
export interface SearchNormalCase {
  readonly input: string;
  readonly expected: string;
}

/** An inclusive range of characters (first and last), so the SQL side can build the same explicit character class. */
export type CharacterRange = readonly [first: string, last: string];

/**
 * Every Unicode `Cf` (format) range, listed explicitly so the SQL normaliser strips the same characters without a
 * `\p{Cf}` class (Postgres regexes have none). Unicode 17.0, the version of the pinned Node.
 */
export const SEARCH_FORMAT_CHARACTER_RANGES: readonly CharacterRange[] = [
  ['\u00AD', '\u00AD'],
  ['\u0600', '\u0605'],
  ['\u061C', '\u061C'],
  ['\u06DD', '\u06DD'],
  ['\u070F', '\u070F'],
  ['\u0890', '\u0891'],
  ['\u08E2', '\u08E2'],
  ['\u180E', '\u180E'],
  ['\u200B', '\u200F'],
  ['\u202A', '\u202E'],
  ['\u2060', '\u2064'],
  ['\u2066', '\u206F'],
  ['\uFEFF', '\uFEFF'],
  ['\uFFF9', '\uFFFB'],
  ['\u{110BD}', '\u{110BD}'],
  ['\u{110CD}', '\u{110CD}'],
  ['\u{13430}', '\u{1343F}'],
  ['\u{1BCA0}', '\u{1BCA3}'],
  ['\u{1D173}', '\u{1D17A}'],
  ['\u{E0001}', '\u{E0001}'],
  ['\u{E0020}', '\u{E007F}'],
];

/** All characters of one range as a string. */
function charactersOf([first, last]: CharacterRange): string {
  const from = first.codePointAt(0) ?? 0;
  const to = last.codePointAt(0) ?? 0;
  return Array.from({ length: to - from + 1 }, (_, offset) => String.fromCodePoint(from + offset)).join('');
}

/** One row per format range: the whole range sits between two letters and disappears. */
const FORMAT_CHARACTER_CASES: readonly SearchNormalCase[] = SEARCH_FORMAT_CHARACTER_RANGES.map((range) => ({
  input: `x${charactersOf(range)}y`,
  expected: 'xy',
}));

/** Arabic: harakat, tatweel, Quranic marks and letter variants (ADR 0014, D2305). Escapes keep invisible marks reviewable. */
const ARABIC_CASES: readonly SearchNormalCase[] = [
  { input: 'حِذَاءٌ', expected: 'حذاء' },
  { input: 'مُحَمَّد', expected: 'محمد' },
  { input: 'هٰذا', expected: 'هذا' },
  { input: 'كـــتاب', expected: 'كتاب' },
  { input: 'قلۖ', expected: 'قل' },
  { input: 'أحمر', expected: 'احمر' },
  { input: 'إطار', expected: 'اطار' },
  { input: 'آلة', expected: 'اله' },
  { input: 'ٱلله', expected: 'الله' },
  { input: 'فتى', expected: 'فتي' },
  { input: 'مدرسة', expected: 'مدرسه' },
  { input: 'مؤمن', expected: 'مومن' },
  { input: 'بيئة', expected: 'بييه' },
  { input: 'جزائر', expected: 'جزاير' },
  { input: 'ماء', expected: 'ماء' },
  { input: 'آية', expected: 'ايه' },
  { input: 'مؤمن', expected: 'مومن' },
  { input: 'ﻻ', expected: 'لا' },
  { input: 'ﺏ', expected: 'ب' },
  {
    input: 'الْقُفْطَانُ الأَحْمَر',
    expected: 'القفطان الاحمر',
  },
];

/** Digits: Arabic-Indic and Eastern Arabic-Indic read as ASCII. */
const DIGIT_CASES: readonly SearchNormalCase[] = [
  { input: '٠١٢٣٤٥٦٧٨٩', expected: '0123456789' },
  { input: '۰۱۲۳۴۵۶۷۸۹', expected: '0123456789' },
  { input: 'مقاس ٤٢', expected: 'مقاس 42' },
];

/** Latin: case, accents (NFD marks and the letters `unaccent` maps explicitly), ligatures and width forms. */
const LATIN_CASES: readonly SearchNormalCase[] = [
  { input: 'ROBE', expected: 'robe' },
  { input: 'éèê', expected: 'eee' },
  { input: 'à â', expected: 'a a' },
  { input: 'Ç', expected: 'c' },
  { input: 'ô û ï', expected: 'o u i' },
  { input: 'Crème Brûlée', expected: 'creme brulee' },
  { input: 'Straße', expected: 'strasse' },
  { input: 'GROẞ', expected: 'gross' },
  { input: 'ﬁlet', expected: 'filet' },
  { input: 'ＡＢＣ１２３', expected: 'abc123' },
  { input: 'Smørrebrød', expected: 'smorrebrod' },
  { input: 'Cœur', expected: 'coeur' },
  { input: 'Ætna', expected: 'aetna' },
  { input: 'Łódź', expected: 'lodz' },
  { input: 'İstanbul', expected: 'istanbul' },
  { input: 'ılık', expected: 'ilik' },
];

/** Whitespace and mixed script. */
const LAYOUT_CASES: readonly SearchNormalCase[] = [
  { input: '', expected: '' },
  { input: '  robe \t\n  rouge  ', expected: 'robe rouge' },
  { input: ' robe  rouge', expected: 'robe rouge' },
  { input: 'Robe قفطان 2025', expected: 'robe قفطان 2025' },
  { input: 'ق؜فطان ‏robe', expected: 'قفطان robe' },
];

/**
 * The parity table shared by `normalizeForSearch` and the SQL normaliser of the storefront search (ADR 0014: "TS and SQL
 * normalisers share one test table"). A change to either normaliser changes a row here and bumps `SEARCH_NORMAL_VERSION`.
 */
export const SEARCH_NORMAL_CASES: readonly SearchNormalCase[] = [
  ...ARABIC_CASES,
  ...DIGIT_CASES,
  ...LATIN_CASES,
  ...LAYOUT_CASES,
  ...FORMAT_CHARACTER_CASES,
];
