import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import type { RawQuery } from '../../../../../../src/catalog/listing-query';
import { t } from '../../../../../../src/i18n/messages';
import { storeMetadata, tenantMetadata } from '../../../../../../src/seo/metadata';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';
import { ProductsContent } from '../../../../../../src/views/listing-pages';

interface ProductsPageProps {
  readonly params: Promise<TenantRouteParams>;
  readonly searchParams: Promise<RawQuery>;
}

export function generateMetadata({ params }: ProductsPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant) =>
    storeMetadata(tenant, { path: STOREFRONT_PAGE_PATHS.products, title: t(tenant.locale, 'products.title') }),
  );
}

/** Every listed product of the store; `page` and `sort` are validated before they reach a cache key. */
export default function ProductsPage({ params, searchParams }: ProductsPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <ProductsContent params={params} query={searchParams} />
    </Suspense>
  );
}
