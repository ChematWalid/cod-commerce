import { ROLE_NAME_MAX_LENGTH } from '@cod/shared';
import { RoleNameInvalidError } from './errors';

/** A role name as kept, and the key that decides whether two names are the same (D71). */
export interface ParsedRoleName {
  readonly name: string;
  readonly nameKey: string;
}

const RUN_OF_SPACES = /\s+/g;

/** JavaScript has no casefold; going through upper case first also folds `ß` to `ss`. */
const caseFolded = (text: string): string => text.toUpperCase().toLowerCase();

/**
 * Normalises a role name (NFKC, trimmed, runs of spaces collapsed) and derives its uniqueness key.
 *
 * @throws {RoleNameInvalidError} when the result is empty or longer than {@link ROLE_NAME_MAX_LENGTH} characters.
 */
export function parseRoleName(raw: string): ParsedRoleName {
  const name = raw.normalize('NFKC').replace(RUN_OF_SPACES, ' ').trim();
  const characters = Array.from(name).length;
  if (characters === 0 || characters > ROLE_NAME_MAX_LENGTH) {
    throw new RoleNameInvalidError();
  }
  return { name, nameKey: caseFolded(name) };
}

/** The languages a copy can be named in (D71). */
export type CopyLocale = 'en' | 'ar';

const DEFAULT_COPY_LOCALE: CopyLocale = 'en';
const COPY_WORDS: Readonly<Record<CopyLocale, string>> = { en: 'copy', ar: 'نسخة' };

/** The locale a client asked for; anything else names the copy in the default language. */
export const copyLocaleOf = (locale: string | undefined): CopyLocale =>
  locale === 'ar' || locale === 'en' ? locale : DEFAULT_COPY_LOCALE;

const copySuffix = (locale: CopyLocale, ordinal: number): string =>
  ordinal === 1 ? ` (${COPY_WORDS[locale]})` : ` (${COPY_WORDS[locale]} ${String(ordinal)})`;

const clipped = (name: string, characters: number): string => Array.from(name).slice(0, characters).join('').trimEnd();

/**
 * The first free copy name of `source`: `(copy)`, then `(copy 2)` and up. The source is cut so the result stays within
 * {@link ROLE_NAME_MAX_LENGTH} characters (D71). `isTaken` is asked about name keys, so spelling variants collide.
 */
export function copyNameOf(source: string, locale: CopyLocale, isTaken: (nameKey: string) => boolean): ParsedRoleName {
  let ordinal = 1;
  for (;;) {
    const suffix = copySuffix(locale, ordinal);
    const parsed = parseRoleName(clipped(source, ROLE_NAME_MAX_LENGTH - Array.from(suffix).length) + suffix);
    if (!isTaken(parsed.nameKey)) return parsed;
    ordinal += 1;
  }
}
