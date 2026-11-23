import { PLATFORM_LANGUAGE_CODES } from '@cod/shared';
import { type ReactNode, Suspense } from 'react';
import { LocaleRoot } from '../../../src/i18n/locale-root';
import '../../../src/theme/theme.css';

interface LocaleParams {
  readonly locale: string;
}

interface LocaleLayoutProps {
  readonly children: ReactNode;
  readonly params: Promise<LocaleParams>;
}

/** One shell per platform language; the proxy only ever rewrites to these. */
export function generateStaticParams(): LocaleParams[] {
  return PLATFORM_LANGUAGE_CODES.map((locale) => ({ locale }));
}

async function LocaleFromParams({ children, params }: LocaleLayoutProps): Promise<ReactNode> {
  const { locale } = await params;
  return <LocaleRoot locale={locale}>{children}</LocaleRoot>;
}

/**
 * Every store page in the store's language, which the proxy put first in the tenant path (D3202); never the buyer's
 * Accept-Language or a cookie (ADR 0005). params are awaited inside the Suspense boundary: awaiting them at the top
 * of the layout fails the build.
 */
export default function LocaleLayout({ children, params }: LocaleLayoutProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <LocaleFromParams params={params}>{children}</LocaleFromParams>
    </Suspense>
  );
}
