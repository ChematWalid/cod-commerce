import { storeTag, themeTag } from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import type { ReactNode } from 'react';
import { loadCollections, loadProductPage } from '../catalog/catalog-loaders';
import type { TenantRouteParams } from '../tenancy/verified-tenant';
import { renderPage } from '../theme/render-page';
import { themeSource } from '../theme/theme-source';
import { basePageData, type PageBodyProps } from './page-data';
import { requireTenant } from './require-tenant';

/** The home grid shows the newest products. */
const HOME_LISTING = { page: 1, sort: 'newest' } as const;

// Cached per store and theme and tagged, so a store, theme or product change revalidates exactly its entries.
async function HomeBody({ tenant, themeName }: PageBodyProps): Promise<ReactNode> {
  'use cache';
  cacheTag(storeTag(tenant.storeId), themeTag(tenant.storeId));
  cacheLife('hours');
  const [products, collections] = await Promise.all([loadProductPage(tenant, HOME_LISTING), loadCollections(tenant)]);
  return renderPage('home', themeSource.themeNamed(themeName), {
    ...(await basePageData(tenant)),
    products,
    collections,
  });
}

/** A store's home page: the tenant from the route params only, never the request (ADR 0006). */
export async function HomeContent({ params }: { params: Promise<TenantRouteParams> }): Promise<ReactNode> {
  const tenant = await requireTenant(await params);
  if (tenant === null) return null;
  return <HomeBody tenant={tenant} themeName={themeSource.themeNameFor(tenant.store)} />;
}
