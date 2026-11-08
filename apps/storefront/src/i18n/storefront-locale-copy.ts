import type { StoreLocale } from '../tenancy/store-locale';

/** The `dir` of a document in a store locale. */
export type DocumentDirection = 'rtl' | 'ltr';

/** The language of a document before a store applies: Arabic, the platform's primary language (ADR 0005). */
export const DEFAULT_DOCUMENT_LOCALE: StoreLocale = 'ar';

/** The not-found message of each store locale. */
export const NOT_FOUND_MESSAGES: Readonly<Record<StoreLocale, string>> = {
  ar: 'الصفحة غير موجودة',
  fr: 'Page introuvable',
  en: 'Page not found',
};

/** Arabic is the only right-to-left platform language. */
export function documentDirection(locale: StoreLocale): DocumentDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
