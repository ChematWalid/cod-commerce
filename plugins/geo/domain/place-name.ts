import {
  ARABIC_ALEF_MAQSURA,
  ARABIC_DIACRITICS,
  ARABIC_HAA,
  ARABIC_HAMZA_ALEFS,
  ARABIC_PLAIN_ALEF,
  ARABIC_TAA_MARBUTA,
  ARABIC_TATWEEL,
  ARABIC_YAA,
  LATIN_COMBINING_MARKS,
  NAME_SEPARATORS,
} from './constants';

/** The names a wilaya or a commune is found by: its French and Arabic names and its other spellings. */
export interface NamedPlace {
  readonly name: string;
  readonly arabicName: string;
  readonly names: readonly string[];
}

/**
 * A place name reduced for "type to find" matching: lower case, without Latin accents or Arabic diacritics, the
 * tatweel removed, every hamza form of alef written as a plain alef, taa marbuta as haa and alef maqsura as yaa, and
 * hyphens, apostrophes and runs of spaces read as one space. Buyers type "ain temouchent" or "ادرار" for
 * "Aïn Témouchent" or "أدرار".
 */
export function fold(name: string): string {
  return name
    .normalize('NFD')
    .replace(LATIN_COMBINING_MARKS, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(ARABIC_TATWEEL, '')
    .replace(ARABIC_HAMZA_ALEFS, ARABIC_PLAIN_ALEF)
    .replace(ARABIC_TAA_MARBUTA, ARABIC_HAA)
    .replace(ARABIC_ALEF_MAQSURA, ARABIC_YAA)
    .toLowerCase()
    .replace(NAME_SEPARATORS, ' ')
    .trim();
}

/** True when the folded `query` occurs in one of the place's folded names; a blank query matches every place. */
export function matchesPlaceName(query: string, place: NamedPlace): boolean {
  const needle = fold(query);
  if (needle === '') return true;
  return [place.name, place.arabicName, ...place.names].some((candidate) => fold(candidate).includes(needle));
}

/** The places whose names match `query`, in their given order. */
export function filterByName<Place extends NamedPlace>(query: string, places: readonly Place[]): Place[] {
  return places.filter((place) => matchesPlaceName(query, place));
}
