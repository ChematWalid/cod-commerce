/** The combining accents NFD splits off Latin letters (é → e + U+0301). */
export const LATIN_COMBINING_MARKS = /[̀-ͯ]/g;

/** The Arabic short vowels, tanween, shadda, sukun and superscript alef: optional in written names. */
export const ARABIC_DIACRITICS = /[ً-ٰٟ]/g;

/** The Arabic tatweel (kashida), a stretching mark with no meaning. */
export const ARABIC_TATWEEL = /ـ/g;

/**
 * The alef forms buyers type interchangeably: with hamza above or below, with madda, and wasla. NFD already splits
 * U+0623/U+0625/U+0622 into a plain alef and a combining hamza or madda (U+0654/U+0655/U+0653), removed with the
 * diacritics; the precomposed forms stay listed for the strings NFD leaves as they are.
 */
export const ARABIC_HAMZA_ALEFS = /[آأإٱ]/g;

/** The plain Arabic alef every hamza form folds to. */
export const ARABIC_PLAIN_ALEF = 'ا';

/** Hyphens, apostrophes (straight and typographic), dots and whitespace runs: one separator in a folded name. */
export const NAME_SEPARATORS = /[\s\-'’‘`.]+/g;
