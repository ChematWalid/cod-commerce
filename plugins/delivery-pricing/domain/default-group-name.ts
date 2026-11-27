import { isPlatformLanguageCode, PLATFORM_DEFAULT_FEE_GROUP_NAMES } from '@cod/shared';

/**
 * The seeded fee group's name in the store's language (D3124): our own name, never presented as a carrier's official
 * grid. A store whose language is unknown (or not a platform language) gets the English name.
 */
export function platformDefaultGroupName(language: string | null): string {
  if (language !== null && isPlatformLanguageCode(language)) return PLATFORM_DEFAULT_FEE_GROUP_NAMES[language];
  return PLATFORM_DEFAULT_FEE_GROUP_NAMES.en;
}
