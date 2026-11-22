'use client';

import { type ReactNode, useEffect } from 'react';
import type { StoreLocale } from '../tenancy/store-locale';
import { documentDirection } from './storefront-locale-copy';

interface StoreDocumentLangProps {
  readonly locale: StoreLocale;
}

/**
 * Sets `html[lang]` and `html[dir]` to the store's locale after hydration. It stays because a root layout per store
 * language does not build on Next 16.4.5 under the encoded `%5Ft` folder: the server sets `lang` and `dir` on the
 * tenant wrapper instead (D3221).
 */
export function StoreDocumentLang({ locale }: StoreDocumentLangProps): ReactNode {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = documentDirection(locale);
  }, [locale]);
  return null;
}
