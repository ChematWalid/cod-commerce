import { STOREFRONT_PAGE_PATHS, type StorefrontProduct } from '@cod/shared';
import type { Metadata } from 'next';
import { loadCollectionPage, loadProduct } from '../catalog/catalog-loaders';
import { assetSource } from '../images/asset-source';
import { isPrerenderSentinel, verifyTenant } from '../tenancy/tenant-verifier-instance';
import type { TenantRouteParams, VerifiedTenant } from '../tenancy/verified-tenant';
import { canonicalUrl } from './canonical';

/** The metadata of a page that must not be indexed: a soft 404 or a buyer's own page (cart, checkout, search). */
export const NOINDEX_METADATA: Metadata = { robots: { index: false, follow: false } };

/** What a page's metadata adds to the store's. */
interface PageMetadata {
  readonly path: string;
  readonly title?: string;
  readonly description?: string;
  readonly imagePath?: string | null;
  readonly indexable?: boolean;
}

/** Title, description, Open Graph and the canonical URL on the store's primary host. */
export function storeMetadata(tenant: VerifiedTenant, page: PageMetadata): Metadata {
  const { store } = tenant;
  const title = page.title === undefined || page.title === '' ? store.name : `${page.title} | ${store.name}`;
  const description = page.description === undefined || page.description === '' ? store.description : page.description;
  const url = canonicalUrl(store, page.path);
  const images = page.imagePath ? [{ url: assetSource(page.imagePath) }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: store.name,
      locale: tenant.locale,
      type: 'website',
      ...(images && { images }),
    },
    ...(page.indexable === false && NOINDEX_METADATA),
  };
}

/**
 * The metadata of a tenant page: `build` runs only for a verified tenant; any other path is `noindex` and names no
 * store.
 */
export async function tenantMetadata<P extends TenantRouteParams>(
  params: Promise<P>,
  build: (tenant: VerifiedTenant, route: P) => Promise<Metadata> | Metadata,
): Promise<Metadata> {
  const route = await params;
  if (isPrerenderSentinel(route)) return NOINDEX_METADATA;
  const tenant = await verifyTenant(route);
  return tenant === null ? NOINDEX_METADATA : build(tenant, route);
}

function productMetadata(tenant: VerifiedTenant, product: StorefrontProduct): Metadata {
  return storeMetadata(tenant, {
    path: `${STOREFRONT_PAGE_PATHS.product}/${encodeURIComponent(product.slug)}`,
    title: product.metaTitle === '' ? product.name : product.metaTitle,
    description: product.metaDescription,
    imagePath: product.images[0]?.path ?? null,
  });
}

/** The metadata of a product page; an unknown slug is `noindex`. */
export async function productPageMetadata(tenant: VerifiedTenant, slug: string): Promise<Metadata> {
  const product = await loadProduct(tenant, slug);
  return product === null ? NOINDEX_METADATA : productMetadata(tenant, product);
}

/** The metadata of a collection page; an unknown slug is `noindex`. */
export async function collectionPageMetadata(tenant: VerifiedTenant, slug: string): Promise<Metadata> {
  const page = await loadCollectionPage(tenant, slug, { page: 1, sort: 'newest' });
  if (page === null) return NOINDEX_METADATA;
  const { collection } = page;
  return storeMetadata(tenant, {
    path: `${STOREFRONT_PAGE_PATHS.category}/${encodeURIComponent(collection.slug)}`,
    title: collection.title,
    description: collection.description,
    imagePath: collection.imagePath,
  });
}
