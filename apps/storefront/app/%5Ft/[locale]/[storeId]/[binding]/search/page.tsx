import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import type { RawQuery } from '../../../../../../src/catalog/listing-query';
import { t } from '../../../../../../src/i18n/messages';
import { storeMetadata, tenantMetadata } from '../../../../../../src/seo/metadata';
import type { TenantRouteParams } from '../../../../../../src/tenancy/verified-tenant';
import { SearchContent } from '../../../../../../src/views/listing-pages';

interface SearchPageProps {
  readonly params: Promise<TenantRouteParams>;
  readonly searchParams: Promise<RawQuery>;
}

export function generateMetadata({ params }: SearchPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant) =>
    storeMetadata(tenant, {
      path: STOREFRONT_PAGE_PATHS.search,
      title: t(tenant.locale, 'search.title'),
      indexable: false,
    }),
  );
}

/** Search results, per request: never in the shared cache, `no-store` at the edge (D3214). */
export default function SearchPage({ params, searchParams }: SearchPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <SearchContent params={params} query={searchParams} />
    </Suspense>
  );
}
