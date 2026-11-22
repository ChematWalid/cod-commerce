import { storeTag, themeTag } from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { isPrerenderSentinel, verifyTenant } from '../../../../../src/tenancy/tenant-verifier-instance';
import type { TenantRouteParams, VerifiedTenant } from '../../../../../src/tenancy/verified-tenant';
import { renderPage } from '../../../../../src/theme/render-page';
import { themeSource } from '../../../../../src/theme/theme-source';

interface TenantPageProps {
  readonly params: Promise<TenantRouteParams>;
}

interface HomeBodyProps {
  readonly tenant: VerifiedTenant;
}

// Cached per store and tagged, so a store or theme change revalidates exactly its own entries (ADR 0006).
async function HomeBody({ tenant }: HomeBodyProps): Promise<ReactNode> {
  'use cache';
  cacheTag(storeTag(tenant.storeId), themeTag(tenant.storeId));
  cacheLife('hours');
  const theme = themeSource.themeFor(tenant.store);
  return renderPage('home', theme, { locale: tenant.locale, store: tenant.store, year: new Date().getUTCFullYear() });
}

async function Home({ params }: TenantPageProps): Promise<ReactNode> {
  const route = await params;
  if (isPrerenderSentinel(route)) return null;
  const tenant = await verifyTenant(route);
  if (tenant === null) notFound();
  return <HomeBody tenant={tenant} />;
}

/** A store's home page, reached only through the proxy's rewrite to `/_t/{locale}/{storeId}/{binding}`. */
export default function TenantHomePage({ params }: TenantPageProps): ReactNode {
  return (
    <Suspense fallback={null}>
      <Home params={params} />
    </Suspense>
  );
}
