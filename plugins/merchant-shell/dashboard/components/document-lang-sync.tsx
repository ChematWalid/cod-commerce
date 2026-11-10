import { useDisplayLocale } from '@vendure/dashboard';
import { type PropsWithChildren, type ReactNode, useEffect } from 'react';
import { toDocumentLang } from '../document-lang';

/**
 * Keeps `html[lang]` in step with the display language. The dashboard sets `html[dir]` itself but leaves
 * `lang` at `en` (ADR 0010, Evidence (c)), so the Arabic font rule and screen readers would miss Arabic.
 */
export function DocumentLangSync({ children }: PropsWithChildren): ReactNode {
  const { bcp47Tag } = useDisplayLocale();
  useEffect(() => {
    document.documentElement.lang = toDocumentLang(bcp47Tag);
  }, [bcp47Tag]);
  return children;
}
