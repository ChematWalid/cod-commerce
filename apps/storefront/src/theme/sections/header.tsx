import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The store name, linking home, and the main navigation. */
export function Header({ data }: SectionProps): ReactNode {
  const { locale, store } = data;
  return (
    <header className="site-header">
      <Link href={STOREFRONT_PAGE_PATHS.home} className="store-name" data-testid="store-name">
        {store.name}
      </Link>
      <nav aria-label={t(locale, 'nav.menu')} className="site-nav">
        <Link href={STOREFRONT_PAGE_PATHS.products}>{t(locale, 'nav.products')}</Link>
        <Link href={STOREFRONT_PAGE_PATHS.search}>{t(locale, 'nav.search')}</Link>
        <Link href={STOREFRONT_PAGE_PATHS.cart}>{t(locale, 'nav.cart')}</Link>
      </nav>
    </header>
  );
}
