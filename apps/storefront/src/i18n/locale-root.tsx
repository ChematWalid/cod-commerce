import { directionOf, isPlatformLanguageCode, type PlatformLanguageCode } from '@cod/shared';
import type { ReactNode } from 'react';
import { StoreDocumentLang } from './store-document-lang';
import { DEFAULT_DOCUMENT_LOCALE } from './storefront-locale-copy';

interface LocaleRootProps {
  /** The locale segment of the tenant path, untrusted until checked against the platform languages. */
  readonly locale: string;
  readonly children: ReactNode;
}

function documentLocale(locale: string): PlatformLanguageCode {
  return isPlatformLanguageCode(locale) ? locale : DEFAULT_DOCUMENT_LOCALE;
}

/**
 * Store content in the store's language: `lang` and `dir` on the server-rendered wrapper (Arabic right to left), and
 * on `<html>` once hydrated, because a root layout per language does not build (D3221). A locale that is not a
 * platform language falls back to Arabic; the tenant check refuses it anyway.
 */
export function LocaleRoot({ locale, children }: LocaleRootProps): ReactNode {
  const documentLang = documentLocale(locale);
  return (
    <div lang={documentLang} dir={directionOf(documentLang)} className="locale-root">
      <StoreDocumentLang locale={documentLang} />
      {children}
    </div>
  );
}
