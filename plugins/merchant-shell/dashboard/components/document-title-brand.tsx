import { PRODUCT_NAME } from '@cod/shared';
import { type PropsWithChildren, type ReactNode, useEffect } from 'react';
import { brandedTitle } from '../model/document-title';

/** What the observer watches: the `<title>` element, its text, and its being added or replaced. */
const TITLE_OBSERVER_OPTIONS: MutationObserverInit = { childList: true, subtree: true, characterData: true };

/**
 * Replaces the framework's name in the tab title with ours (D91). The dashboard hard-codes it as the suffix and
 * writes `document.title` on every render, with no option, so this watches the title and rewrites it. The write is
 * guarded: a title that is already branded is not written again, so the observer does not trigger itself.
 */
export function DocumentTitleBrand({ children }: PropsWithChildren): ReactNode {
  useEffect(() => {
    const apply = (): void => {
      const branded = brandedTitle(document.title, PRODUCT_NAME);
      if (branded !== document.title) document.title = branded;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, TITLE_OBSERVER_OPTIONS);
    return () => {
      observer.disconnect();
    };
  }, []);
  return children;
}
