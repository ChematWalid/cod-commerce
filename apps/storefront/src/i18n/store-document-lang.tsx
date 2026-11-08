'use client';

import { type ReactNode, useEffect } from 'react';
import type { StoreLocale } from '../tenancy/store-locale';
import { documentDirection } from './storefront-locale-copy';

interface StoreDocumentLangProps {
  readonly locale: StoreLocale;
}

/** Sets `html[lang]` and `html[dir]` to the store's locale, until P3.S2's per-locale root layouts do it on the server. */
export function StoreDocumentLang({ locale }: StoreDocumentLangProps): ReactNode {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = documentDirection(locale);
  }, [locale]);
  return null;
}
