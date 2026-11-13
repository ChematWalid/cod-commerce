import { summariseIcu } from './icu-message';
import type { PoEntry } from './po-catalogue';

/** The CLDR plural categories of Arabic: an Arabic plural message names all six (ADR 0005). */
const ARABIC_PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** A parsed catalogue: id to entry. */
export type ParsedCatalogue = ReadonlyMap<string, PoEntry>;

const isBlank = (text: string): boolean => text.trim() === '';

/**
 * Whether an Arabic entry flattens a plural: a gettext plural (`msgid_plural`) needs six non-blank forms, and each
 * ICU `plural` block, nested ones included, names the six categories as its own selectors.
 */
export function lacksArabicPluralForms(entry: PoEntry): boolean {
  if (entry.plural) {
    return entry.forms.length < ARABIC_PLURAL_CATEGORIES.length || entry.forms.some(isBlank);
  }
  return summariseIcu(entry.translation).pluralSelectors.some((selectors) =>
    ARABIC_PLURAL_CATEGORIES.some((category) => !selectors.includes(category)),
  );
}

const sortedNames = (text: string): string => [...summariseIcu(text).argumentNames].sort().join(',');

/**
 * Whether a translation names other placeholders than its English source (`{count}`, `{name}`, a plural's argument).
 * A blank side is left to the gap check.
 */
export function placeholdersDiffer(english: string, translation: string): boolean {
  if (isBlank(english) || isBlank(translation)) return false;
  return sortedNames(english) !== sortedNames(translation);
}
