import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The product's description as text: the catalog's markup is never injected into the page. */
export function Description({ data }: SectionProps): ReactNode {
  const description = data.product?.description ?? '';
  if (description === '') return null;
  return (
    <div className="description">
      <h2>{t(data.locale, 'product.description')}</h2>
      <p>{description}</p>
    </div>
  );
}
