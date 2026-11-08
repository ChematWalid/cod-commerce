import type { ReactNode } from 'react';
import { DEFAULT_DOCUMENT_LOCALE, documentDirection } from '../src/i18n/storefront-locale-copy';
import '../src/i18n/stub.css';

interface RootLayoutProps {
  readonly children: ReactNode;
}

/** The root layout, in the platform's primary language. Per-locale root layouts (`lang`, `dir`) come in P3.S2. */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang={DEFAULT_DOCUMENT_LOCALE} dir={documentDirection(DEFAULT_DOCUMENT_LOCALE)}>
      <body>{children}</body>
    </html>
  );
}
