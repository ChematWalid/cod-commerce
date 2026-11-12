import { isFlagKey } from '@cod/shared';

/** The catalogue id of a known flag's description (one id builder for the page and for i18n:check). */
export function descriptionMessageIdFor(key: string): string {
  return `flags.description.${key}`;
}

/** The catalogue id of a known flag's description; staff-created or future keys have none. */
export function flagDescriptionMessageId(key: string): string | undefined {
  return isFlagKey(key) ? descriptionMessageIdFor(key) : undefined;
}

/** The description in the page's language for a known flag, otherwise the one stored with the flag. */
export function flagDescription(
  translate: (id: string) => string,
  flag: { readonly key: string; readonly description: string },
): string {
  const id = flagDescriptionMessageId(flag.key);
  return id === undefined ? flag.description : translate(id);
}
