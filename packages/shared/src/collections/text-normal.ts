/** Arabic harakat, Quranic annotation marks and the superscript alef: dropped before matching. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/gu;

/** Tatweel (kashida), a stretching stroke with no meaning. */
const TATWEEL = /ـ/gu;

const WHITESPACE_RUN = /\s+/gu;

/** Letter variants merchants mix when they type (D2305): hamza alefs, alef maqsura, ta marbuta. */
const LETTER_FOLDS: readonly (readonly [RegExp, string])[] = [
  [/[أإآ]/gu, 'ا'],
  [/ى/gu, 'ي'],
  [/ة/gu, 'ه'],
];

/**
 * The form two texts are compared in by collection rules (D2305): NFC, lower case, Arabic harakat and tatweel removed,
 * the alef variants `أ إ آ` read as `ا`, `ى` as `ي`, `ة` as `ه`, and whitespace collapsed and trimmed. Arabic titles
 * are stored NFD (D2112) and merchants type without harakat, so a raw comparison would miss them. A change here bumps
 * `NORMAL_FORM_VERSION`.
 */
export function normalForMatch(text: string): string {
  const folded = LETTER_FOLDS.reduce(
    (current, [variants, letter]) => current.replace(variants, letter),
    text.normalize('NFC').toLowerCase(),
  );
  return folded.replace(ARABIC_MARKS, '').replace(TATWEEL, '').replace(WHITESPACE_RUN, ' ').trim().normalize('NFC');
}
