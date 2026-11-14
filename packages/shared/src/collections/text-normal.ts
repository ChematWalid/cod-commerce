/**
 * Arabic harakat, Quranic annotation marks and the superscript alef: dropped before matching. Written as escapes: raw
 * combining marks are invisible in review and an editor could merge them into their neighbours.
 */
const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/gu;

/** Tatweel (kashida), a stretching stroke with no meaning. */
const TATWEEL = /\u0640/gu;

/**
 * Invisible format characters (zero-width space, joiner and non-joiner, word joiner, soft hyphen, BOM, bidi marks):
 * text pasted from social posts carries them inside words, and a merchant cannot type them.
 */
const FORMAT_CHARACTERS = /\p{Cf}/gu;

/** The Turkish dotted capital I lower-cases to `i` plus a combining dot; it is read as a plain `i`. */
const DOTTED_I = /i\u0307/gu;

const WHITESPACE_RUN = /\s+/gu;

/** Letter variants merchants mix when they type (D2305): hamza and wasla alefs, alef maqsura, ta marbuta, sharp s. */
const LETTER_FOLDS: readonly (readonly [RegExp, string])[] = [
  [/[\u0623\u0625\u0622\u0671]/gu, '\u0627'],
  [/\u0649/gu, '\u064A'],
  [/\u0629/gu, '\u0647'],
  [/\u00DF/gu, 'ss'],
  [DOTTED_I, 'i'],
];

/**
 * The form two texts are compared in by collection rules (D2305): NFKC (so Arabic presentation forms read as their
 * letters), lower case, Arabic harakat, tatweel and invisible format characters removed, the alef variants `أ إ آ ٱ`
 * read as `ا`, `ى` as `ي`, `ة` as `ه`, `ß` as `ss`, and whitespace collapsed and trimmed. Arabic titles are stored NFD
 * (D2112) and merchants type without harakat, so a raw comparison would miss them. A change here bumps
 * `NORMAL_FORM_VERSION`.
 */
export function normalForMatch(text: string): string {
  const folded = LETTER_FOLDS.reduce(
    (current, [variants, letter]) => current.replace(variants, letter),
    text.normalize('NFKC').toLowerCase(),
  );
  return folded
    .replace(ARABIC_MARKS, '')
    .replace(TATWEEL, '')
    .replace(FORMAT_CHARACTERS, '')
    .replace(WHITESPACE_RUN, ' ')
    .trim()
    .normalize('NFKC');
}
