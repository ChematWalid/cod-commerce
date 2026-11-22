import { STOREFRONT_PAGE_PATHS, type StorefrontLocale, type StorefrontMessageKey } from '@cod/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CartView } from '../../client/cart-view';
import { t } from '../../i18n/messages';
import type { SectionProps } from '../section-props';

/** The order form's fields in display order; the address only when the store asks for it (`showAddressField`). */
const FIELD_KEYS: readonly StorefrontMessageKey[] = [
  'checkout.name',
  'checkout.phone',
  'checkout.wilaya',
  'checkout.commune',
];

function fieldKeysOf(showAddressField: boolean): readonly StorefrontMessageKey[] {
  return showAddressField ? [...FIELD_KEYS, 'checkout.address'] : FIELD_KEYS;
}

/**
 * The shell of the cash-on-delivery form: labelled, disabled fields and a disabled submit. P3.S3 makes it the real
 * form (delivery prices, order intake); the shell fixes its place in the theme and the address rule.
 */
function OrderFormShell({
  locale,
  showAddressField,
}: {
  locale: StorefrontLocale;
  showAddressField: boolean;
}): ReactNode {
  return (
    <div className="order-form-shell">
      {fieldKeysOf(showAddressField).map((key) => (
        <label key={key} data-field={key.replace('checkout.', '')}>
          <span>{t(locale, key)}</span>
          <input type="text" disabled />
        </label>
      ))}
      <p>{t(locale, 'checkout.cod')}</p>
      <button type="button" className="button" disabled>
        {t(locale, 'checkout.submit')}
      </button>
    </div>
  );
}

function CartSummary({ locale }: { locale: StorefrontLocale }): ReactNode {
  return (
    <CartView
      labels={{
        empty: t(locale, 'cart.empty'),
        remove: t(locale, 'cart.remove'),
        quantity: t(locale, 'product.quantity'),
      }}
    />
  );
}

/**
 * The in-page checkout: on the cart page the cart and a link to checkout, on the checkout and product pages the
 * order form shell (the product page orders its own product, P3.S3).
 */
export function InPageCheckout({ data }: SectionProps): ReactNode {
  const { locale, store } = data;
  const step = data.checkoutStep ?? 'product';
  return (
    <div className="in-page-checkout">
      <h2>{t(locale, step === 'cart' ? 'cart.title' : 'checkout.title')}</h2>
      {step === 'product' ? null : <CartSummary locale={locale} />}
      {step === 'cart' ? (
        <Link href={STOREFRONT_PAGE_PATHS.checkout} className="button">
          {t(locale, 'cart.checkout')}
        </Link>
      ) : (
        <OrderFormShell locale={locale} showAddressField={store.showAddressField} />
      )}
    </div>
  );
}
