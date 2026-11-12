import { FLAG_KEYS } from '@cod/shared';

const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(FLAG_KEYS));

/** The catalogue id of a known flag's description; staff-created or future keys have none. */
export function flagDescriptionMessageId(key: string): string | undefined {
  return KNOWN_KEYS.has(key) ? `flags.description.${key}` : undefined;
}

/** The description in the page's language for a known flag, otherwise the one stored with the flag. */
export function flagDescription(
  translate: (id: string) => string,
  flag: { readonly key: string; readonly description: string },
): string {
  const id = flagDescriptionMessageId(flag.key);
  return id === undefined ? flag.description : translate(id);
}
