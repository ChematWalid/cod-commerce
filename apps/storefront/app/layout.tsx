import type { ReactNode } from 'react';

interface RootLayoutProps {
  readonly children: ReactNode;
}

/** The root layout. Per-locale root layouts (`lang`, `dir`) come in P3.S2. */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
