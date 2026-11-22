import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The thank-you message after an order, with a way back to the products. */
export function SuccessMessage({ data }: SectionProps): ReactNode {
  return (
    <div className="success-message">
      <h1>{t(data.locale, 'success.title')}</h1>
      <p>{t(data.locale, 'success.body')}</p>
      <Link href={STOREFRONT_PAGE_PATHS.products} className="button">
        {t(data.locale, 'success.continue')}
      </Link>
    </div>
  );
}
