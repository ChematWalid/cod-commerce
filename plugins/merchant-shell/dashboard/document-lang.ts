import { PLATFORM_LANGUAGE_CODES, type PlatformLanguageCode } from '@cod/shared';

/** The document languages of the merchant dashboard: the platform languages (ADR 0005), which the dashboard ships. */
export const DASHBOARD_LANGUAGES = PLATFORM_LANGUAGE_CODES;

/** The `html[lang]` value the dashboard document carries: one of the {@link DASHBOARD_LANGUAGES}. */
export type DocumentLang = PlatformLanguageCode;

/** The dashboard default, used for any display locale that is not a platform language. */
const DEFAULT_DOCUMENT_LANG: DocumentLang = 'en';

/** Separates the language from the region in a BCP 47 tag (`fr-DZ`). */
const SUBTAG_SEPARATOR = '-';

/**
 * Maps the dashboard display locale (a BCP 47 tag such as `ar`, `fr-DZ` or `en-GB`) to the document
 * language: the base language when it is a platform language, otherwise `en`, the dashboard default.
 */
export function toDocumentLang(displayLocale: string): DocumentLang {
  const base = displayLocale.toLowerCase().split(SUBTAG_SEPARATOR)[0] ?? '';
  return DASHBOARD_LANGUAGES.find((language) => language === base) ?? DEFAULT_DOCUMENT_LANG;
}
