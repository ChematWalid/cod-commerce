import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { t } from '../../../../../../src/i18n/messages';
import { storeMetadata, tenantMetadata } from '../../../../../../src/seo/metadata';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';
import { OrderContent } from '../../../../../../src/views/order-pages';

interface CartPageProps {
  readonly params: Promise<TenantRouteParams>;
}

export function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant) =>
    storeMetadata(tenant, {
      path: STOREFRONT_PAGE_PATHS.cart,
      title: t(tenant.locale, 'cart.title'),
      indexable: false,
    }),
  );
}

/** The cart kept in the buyer's browser, and the way to checkout. */
export default function CartPage({ params }: CartPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <OrderContent params={params} page="cart" />
    </Suspense>
  );
}
