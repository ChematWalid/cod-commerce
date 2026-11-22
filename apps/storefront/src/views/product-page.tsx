import { storeTag, themeTag } from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { loadProduct, loadProductPage } from '../catalog/catalog-loaders';
import type { TenantRouteParams } from '../tenancy/verified-tenant';
import { renderPage } from '../theme/render-page';
import { themeSource } from '../theme/theme-source';
import { basePageData, type PageBodyProps } from './page-data';
import { requireTenant } from './require-tenant';

/** The route params of a product page. */
export interface ProductRouteParams extends TenantRouteParams {
  readonly slug: string;
}

/** The related grid shows the newest products of the store. */
const RELATED_LISTING = { page: 1, sort: 'newest' } as const;

async function ProductBody({ tenant, themeName, slug }: PageBodyProps & { slug: string }): Promise<ReactNode> {
  'use cache';
  cacheTag(storeTag(tenant.storeId), themeTag(tenant.storeId));
  cacheLife('hours');
  const [product, products] = await Promise.all([loadProduct(tenant, slug), loadProductPage(tenant, RELATED_LISTING)]);
  if (product === null) return null;
  const data = { ...(await basePageData(tenant)), product, products, checkoutStep: 'product' as const };
  return renderPage('product', themeSource.themeNamed(themeName), data);
}

/**
 * A product page. A malformed, unknown or hidden slug renders the soft 404 (`noindex`); the slug is checked before it
 * reaches a cache key or the api. Product pages never read the query string (ADR 0006).
 */
export async function ProductContent({ params }: { params: Promise<ProductRouteParams> }): Promise<ReactNode> {
  const route = await params;
  const tenant = await requireTenant(route);
  if (tenant === null) return null;
  if ((await loadProduct(tenant, route.slug)) === null) notFound();
  return <ProductBody tenant={tenant} themeName={themeSource.themeNameFor(tenant.store)} slug={route.slug} />;
}
