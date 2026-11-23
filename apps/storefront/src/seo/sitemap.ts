import { STOREFRONT_PAGE_PATHS, type StorefrontStore } from '@cod/shared';
import { loadCollections, loadProductPage } from '../catalog/catalog-loaders';
import { MAX_LISTING_PAGE } from '../catalog/listing-query';
import type { VerifiedTenant } from '../tenancy/verified-tenant';
import { pageCountOf } from '../views/page-data';
import { canonicalUrl } from './canonical';

/** The most URLs one sitemap lists; a larger catalog is split into sitemap pages later (P8). */
export const SITEMAP_MAX_URLS = 1000;

/** Buyer pages a crawler must not index. */
const PRIVATE_PATHS: readonly string[] = [
  STOREFRONT_PAGE_PATHS.cart,
  STOREFRONT_PAGE_PATHS.checkout,
  STOREFRONT_PAGE_PATHS.success,
  STOREFRONT_PAGE_PATHS.search,
];

const XML_ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

/** The product paths of the store, newest first, until `limit` paths or the last listing page. */
async function productPaths(tenant: VerifiedTenant, limit: number): Promise<string[]> {
  const paths: string[] = [];
  for (let page = 1; page <= MAX_LISTING_PAGE && paths.length < limit; page += 1) {
    const listing = await loadProductPage(tenant, { page, sort: 'newest' });
    paths.push(...listing.items.map((card) => `${STOREFRONT_PAGE_PATHS.product}/${encodeURIComponent(card.slug)}`));
    if (page >= pageCountOf(listing)) break;
  }
  return paths.slice(0, limit);
}

/**
 * The store's sitemap: home, the product list, its collections and its products, at most {@link SITEMAP_MAX_URLS}
 * URLs, all on the primary host. Built from the verified tenant and the cached catalog, never from the request.
 */
export async function sitemapXml(tenant: VerifiedTenant): Promise<string> {
  const collections = await loadCollections(tenant);
  const fixed = [
    STOREFRONT_PAGE_PATHS.home,
    STOREFRONT_PAGE_PATHS.products,
    ...collections.map((collection) => `${STOREFRONT_PAGE_PATHS.category}/${encodeURIComponent(collection.slug)}`),
  ].slice(0, SITEMAP_MAX_URLS);
  const products = await productPaths(tenant, SITEMAP_MAX_URLS - fixed.length);
  const urls = [...fixed, ...products].map(
    (path) => `<url><loc>${escapeXml(canonicalUrl(tenant.store, path))}</loc></url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>\n`;
}

/** The store's robots.txt: everything but the buyer's own pages, and where the sitemap is. */
export function robotsTxt(store: StorefrontStore): string {
  const disallowed = PRIVATE_PATHS.map((path) => `Disallow: ${path}`);
  return ['User-agent: *', 'Allow: /', ...disallowed, `Sitemap: ${canonicalUrl(store, '/sitemap.xml')}`, ''].join('\n');
}
