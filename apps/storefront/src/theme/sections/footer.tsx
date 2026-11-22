import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The rights notice with the store's name. */
export function Footer({ data }: SectionProps): ReactNode {
  return (
    <footer className="site-footer">
      <p>{t(data.locale, 'footer.rights', { year: data.year, store: data.store.name })}</p>
    </footer>
  );
}
