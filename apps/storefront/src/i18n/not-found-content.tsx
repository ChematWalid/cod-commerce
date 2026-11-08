import { PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import type { ReactNode } from 'react';
import { documentDirection, NOT_FOUND_MESSAGES } from './storefront-locale-copy';

/**
 * The not-found copy in every platform language. Next renders one cached not-found page with no store or
 * route params (ADR 0006), so it cannot pick a language on the server; P3.S2's real storefront can.
 */
export function NotFoundContent(): ReactNode {
  return (
    <main data-testid="not-found" className="stub-page">
      <div>
        {PLATFORM_LANGUAGE_CODES.map((locale) => (
          <h1 key={locale} lang={locale} dir={documentDirection(locale)}>
            {NOT_FOUND_MESSAGES[locale]}
          </h1>
        ))}
      </div>
    </main>
  );
}
