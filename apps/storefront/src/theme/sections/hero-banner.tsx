import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { tFromSetting } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The store's name and description with a call to action to the product list (`ctaKey`). */
export function HeroBanner({ section, data }: SectionProps): ReactNode {
  const { locale, store } = data;
  return (
    <div className="hero-banner">
      <h1>{store.name}</h1>
      {store.description === '' ? null : <p>{store.description}</p>}
      <Link href={STOREFRONT_PAGE_PATHS.products} className="button">
        {tFromSetting(locale, section.settings['ctaKey'], 'hero.cta')}
      </Link>
    </div>
  );
}
