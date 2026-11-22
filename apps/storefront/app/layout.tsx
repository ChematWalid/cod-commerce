import type { ReactNode } from 'react';
import { DEFAULT_DOCUMENT_LOCALE, documentDirection } from '../src/i18n/storefront-locale-copy';
import '../src/i18n/stub.css';

interface RootLayoutProps {
  readonly children: ReactNode;
}

/**
 * The one root layout, in the platform's primary language. A root layout per store language
 * (`app/%5Ft/[locale]/layout.tsx`) fails `next build` (Next 16.4.5 does not match the encoded `%5Ft` folder against
 * the `_t` route when it checks root params), so the store's `lang` and `dir` are set on the tenant layout's
 * wrapper on the server and on `<html>` after hydration (D3221).
 */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang={DEFAULT_DOCUMENT_LOCALE} dir={documentDirection(DEFAULT_DOCUMENT_LOCALE)}>
      <body>{children}</body>
    </html>
  );
}
