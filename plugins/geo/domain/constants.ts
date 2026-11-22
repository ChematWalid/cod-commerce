// The patterns and replacements below use \u escapes, never literal characters: combining marks are invisible.

/** The combining accents NFD splits off Latin letters (U+00E9 é becomes e + U+0301): U+0300 to U+036F. */
export const LATIN_COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * The Arabic short vowels, tanween, shadda, sukun and the combining hamza and madda (U+064B to U+065F), and the
 * superscript alef (U+0670): optional in written names.
 */
export const ARABIC_DIACRITICS = /[ً-ٰٟ]/g;

/** The Arabic tatweel or kashida (U+0640), a stretching mark with no meaning. */
export const ARABIC_TATWEEL = /ـ/g;

/**
 * The alef forms buyers type interchangeably: with madda (U+0622), hamza above (U+0623) or below (U+0625), and wasla
 * (U+0671). NFD already splits U+0622/U+0623/U+0625 into a plain alef and a combining madda or hamza
 * (U+0653/U+0654/U+0655), removed with the diacritics; the precomposed forms stay listed for the strings NFD leaves
 * as they are.
 */
export const ARABIC_HAMZA_ALEFS = /[آأإٱ]/g;

/** The plain Arabic alef (U+0627) every hamza form folds to. */
export const ARABIC_PLAIN_ALEF = 'ا';

/** The taa marbuta (U+0629), which buyers often type as a haa: "المسيله" for "المسيلة". */
export const ARABIC_TAA_MARBUTA = /ة/g;

/** The haa (U+0647) a taa marbuta folds to. */
export const ARABIC_HAA = 'ه';

/** The alef maqsura (U+0649), which buyers often type as a yaa: "الدفلي" for "الدفلى". */
export const ARABIC_ALEF_MAQSURA = /ى/g;

/** The yaa (U+064A) an alef maqsura folds to. */
export const ARABIC_YAA = 'ي';

/**
 * Whitespace, hyphens, apostrophes (straight, right and left typographic U+2019/U+2018, backtick) and dots: one
 * separator in a folded name.
 */
export const NAME_SEPARATORS = /[\s\-'’‘`.]+/g;
