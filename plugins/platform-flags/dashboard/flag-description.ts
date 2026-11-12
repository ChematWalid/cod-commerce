import { FLAG_SEEDS, isFlagKey } from '@cod/shared';

/** The catalogue id of a known flag's description (one id builder for the page and for i18n:check). */
export function descriptionMessageIdFor(key: string): string {
  return `flags.description.${key}`;
}

/** The catalogue id of a known flag's description; staff-created or future keys have none. */
export function flagDescriptionMessageId(key: string): string | undefined {
  return isFlagKey(key) ? descriptionMessageIdFor(key) : undefined;
}

/**
 * The description in the page's language while a known flag still carries its seeded text. Once staff have edited
 * it (`updateFeatureFlag` accepts a description), or for a key the catalogues do not know, the stored text wins:
 * the catalogue only translates our own words, never overrides staff's (D405).
 */
export function flagDescription(
  translate: (id: string) => string,
  flag: { readonly key: string; readonly description: string },
): string {
  const id = flagDescriptionMessageId(flag.key);
  const seeded = FLAG_SEEDS.find((seed) => seed.key === flag.key)?.description;
  return id === undefined || flag.description !== seeded ? flag.description : translate(id);
}
