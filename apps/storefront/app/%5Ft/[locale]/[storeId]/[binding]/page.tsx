import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import { STOREFRONT_PAGE_PATHS } from '@cod/shared';
import { storeMetadata, tenantMetadata } from '../../../../../src/seo/metadata';
import type { TenantRouteParams } from '../../../../../src/tenancy/verified-tenant';
import { HomeContent } from '../../../../../src/views/home-page';

interface TenantPageProps {
  readonly params: Promise<TenantRouteParams>;
}

export function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  return tenantMetadata(params, (tenant) => storeMetadata(tenant, { path: STOREFRONT_PAGE_PATHS.home }));
}

/** A store's home page, reached only through the proxy's rewrite to `/_t/{locale}/{storeId}/{binding}`. */
export default function TenantHomePage({ params }: TenantPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <HomeContent params={params} />
    </Suspense>
  );
}
