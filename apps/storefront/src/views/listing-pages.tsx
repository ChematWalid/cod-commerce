import { STOREFRONT_PAGE_PATHS, storeTag, themeTag } from '@cod/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { loadCollectionPage, loadProductPage, searchProducts } from '../catalog/catalog-loaders';
import { type ListingQuery, listingQueryOf, type RawQuery, searchQueryOf } from '../catalog/listing-query';
import type { TenantRouteParams } from '../tenancy/verified-tenant';
import { renderPage } from '../theme/render-page';
import { themeSource } from '../theme/theme-source';
import { basePageData, type PageBodyProps, pageCountOf } from './page-data';
import { requireTenant } from './require-tenant';

/** The route params of a collection page. */
export interface CollectionRouteParams extends TenantRouteParams {
  readonly slug: string;
}

interface ListingContentProps<P extends TenantRouteParams> {
  readonly params: Promise<P>;
  /** The page's query, read by listing pages only (`page`, `sort`, `q`), validated before any cache key. */
  readonly query: Promise<RawQuery>;
}

async function ProductsBody({ tenant, themeName, listing }: PageBodyProps & { listing: ListingQuery }) {
  'use cache';
  cacheTag(storeTag(tenant.storeId), themeTag(tenant.storeId));
  cacheLife('hours');
  const products = await loadProductPage(tenant, listing);
  const view = { basePath: STOREFRONT_PAGE_PATHS.products, ...listing, pageCount: pageCountOf(products) };
  return renderPage('collection', themeSource.themeNamed(themeName), {
    ...(await basePageData(tenant)),
    products,
    listing: view,
  });
}

/** Every listed product of the store, a page at a time, in the order the buyer picked. */
export async function ProductsContent({ params, query }: ListingContentProps<TenantRouteParams>): Promise<ReactNode> {
  const tenant = await requireTenant(await params);
  if (tenant === null) return null;
  const listing = listingQueryOf(await query);
  return <ProductsBody tenant={tenant} themeName={themeSource.themeNameFor(tenant.store)} listing={listing} />;
}

async function CollectionBody(props: PageBodyProps & { slug: string; listing: ListingQuery }) {
  'use cache';
  const { tenant, themeName, slug, listing } = props;
  cacheTag(storeTag(tenant.storeId), themeTag(tenant.storeId));
  cacheLife('hours');
  const page = await loadCollectionPage(tenant, slug, listing);
  if (page === null) return null;
  const basePath = `${STOREFRONT_PAGE_PATHS.category}/${encodeURIComponent(slug)}`;
  return renderPage('collection', themeSource.themeNamed(themeName), {
    ...(await basePageData(tenant)),
    collection: page.collection,
    products: page.products,
    listing: { basePath, ...listing, pageCount: pageCountOf(page.products) },
  });
}

/** A collection page; a malformed, unknown or hidden collection slug renders the soft 404. */
export async function CollectionContent({ params, query }: ListingContentProps<CollectionRouteParams>) {
  const route = await params;
  const tenant = await requireTenant(route);
  if (tenant === null) return null;
  const listing = listingQueryOf(await query);
  if ((await loadCollectionPage(tenant, route.slug, listing)) === null) notFound();
  const themeName = themeSource.themeNameFor(tenant.store);
  return <CollectionBody tenant={tenant} themeName={themeName} slug={route.slug} listing={listing} />;
}

/**
 * Search results, fetched on every request and never stored in the shared cache; the edge does not store them
 * either (`no-store`, D3214).
 */
export async function SearchContent({ params, query }: ListingContentProps<TenantRouteParams>): Promise<ReactNode> {
  const tenant = await requireTenant(await params);
  if (tenant === null) return null;
  const search = searchQueryOf(await query);
  const products = await searchProducts(tenant, search);
  const listing = {
    basePath: STOREFRONT_PAGE_PATHS.search,
    page: search.page,
    pageCount: pageCountOf(products),
    q: search.q,
  };
  const theme = themeSource.themeNamed(themeSource.themeNameFor(tenant.store));
  return renderPage('search', theme, { ...(await basePageData(tenant)), products, listing });
}
