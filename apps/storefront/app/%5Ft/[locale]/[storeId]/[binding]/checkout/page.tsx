import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { t } from '../../../../../../src/i18n/messages';
import { storeMetadata, tenantMetadata } from '../../../../../../src/seo/metadata';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';
import { OrderContent } from '../../../../../../src/views/order-pages';

interface CheckoutPageProps {
  readonly params: Promise<TenantRouteParams>;
}

export function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant) =>
    storeMetadata(tenant, {
      path: STOREFRONT_PAGE_PATHS.checkout,
      title: t(tenant.locale, 'checkout.title'),
      indexable: false,
    }),
  );
}

/** The checkout shell: the cart and the cash-on-delivery form of P3.S3. */
export default function CheckoutPage({ params }: CheckoutPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <OrderContent params={params} page="checkout" />
    </Suspense>
  );
}
