/** The document languages of the merchant dashboard: Arabic right-to-left and the English default. */
export const DASHBOARD_LANGUAGES = ['en', 'ar'] as const;

/** The `html[lang]` value the dashboard document carries: one of the {@link DASHBOARD_LANGUAGES}. */
export type DocumentLang = (typeof DASHBOARD_LANGUAGES)[number];

const ARABIC_PREFIX = 'ar';

/**
 * Maps the dashboard display locale (a BCP 47 tag such as `ar`, `ar-DZ` or `en-GB`) to the document
 * language. Any Arabic tag is `ar`; everything else falls back to `en`, the dashboard default.
 */
export function toDocumentLang(displayLocale: string): DocumentLang {
  return displayLocale.toLowerCase().startsWith(ARABIC_PREFIX) ? 'ar' : 'en';
}
