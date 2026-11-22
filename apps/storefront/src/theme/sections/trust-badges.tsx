import type { StorefrontMessageKey } from '@cod/shared';
import type { ReactNode } from 'react';
import { t } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The cash-on-delivery promises every store makes, in its language. */
const TRUST_KEYS: readonly StorefrontMessageKey[] = ['trust.cod', 'trust.delivery', 'trust.exchange', 'trust.support'];

/** A row of short reassurance badges. */
export function TrustBadges({ data }: SectionProps): ReactNode {
  return (
    <ul className="trust-badges">
      {TRUST_KEYS.map((key) => (
        <li key={key}>{t(data.locale, key)}</li>
      ))}
    </ul>
  );
}
