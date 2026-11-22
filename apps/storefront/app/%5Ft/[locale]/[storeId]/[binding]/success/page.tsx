import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { t } from '../../../../../../src/i18n/messages';
import { storeMetadata, tenantMetadata } from '../../../../../../src/seo/metadata';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';
import { OrderContent } from '../../../../../../src/views/order-pages';

interface SuccessPageProps {
  readonly params: Promise<TenantRouteParams>;
}

export function generateMetadata({ params }: SuccessPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant) =>
    storeMetadata(tenant, {
      path: STOREFRONT_PAGE_PATHS.success,
      title: t(tenant.locale, 'success.title'),
      indexable: false,
    }),
  );
}

/** The thank-you page after an order. */
export default function SuccessPage({ params }: SuccessPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <OrderContent params={params} page="success" />
    </Suspense>
  );
}
