import type { StorefrontProductCard, StorefrontProductPage } from '@cod/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TenantRouteParams, VerifiedTenant } from '../../src/tenancy/verified-tenant';
import {
  cardFixture,
  collectionFixture,
  productFixture,
  storeFixture,
  tenantFixture,
} from '../support/storefront-fixtures';

const SENTINEL_STORE_ID = 'prerender-sentinel';

const verifyTenant = vi.fn<(route: TenantRouteParams) => Promise<VerifiedTenant | null>>();
const loadProductPage = vi.fn<(tenant: VerifiedTenant, query: { page: number }) => Promise<StorefrontProductPage>>();
const loadCollections = vi.fn();
const loadProduct = vi.fn();
const loadCollectionPage = vi.fn();

vi.mock('next/cache', () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock('../../src/tenancy/tenant-verifier-instance', () => ({
  verifyTenant,
  isPrerenderSentinel: (route: TenantRouteParams) => route.storeId === SENTINEL_STORE_ID,
  PRERENDER_SENTINEL_BINDING: 'prerender-sentinel',
}));
vi.mock('../../src/catalog/catalog-loaders', () => ({
  loadProductPage,
  loadCollections,
  loadProduct,
  loadCollectionPage,
}));

const { robotsResponse, sitemapResponse } = await import('../../src/seo/seo-routes');
const { SITEMAP_MAX_URLS, robotsTxt, sitemapXml } = await import('../../src/seo/sitemap');
const { NOINDEX_METADATA, productPageMetadata, storeMetadata, tenantMetadata } = await import('../../src/seo/metadata');

const TENANT = tenantFixture();
const ROUTE: TenantRouteParams = { locale: 'ar', storeId: TENANT.storeId, binding: 'b'.repeat(22) };
const SENTINEL_ROUTE: TenantRouteParams = { locale: 'ar', storeId: SENTINEL_STORE_ID, binding: 'prerender-sentinel' };
const PAGE_TAKE = 24;

/** A catalog of `total` products, served page by page as the listing api would. */
function catalogOf(total: number): void {
  loadProductPage.mockImplementation(async (_tenant, { page }) => {
    const first = (page - 1) * PAGE_TAKE;
    const count = Math.max(0, Math.min(PAGE_TAKE, total - first));
    const items: StorefrontProductCard[] = Array.from({ length: count }, (_, index) =>
      cardFixture({ id: String(first + index), slug: `p-${String(first + index)}` }),
    );
    return Promise.resolve({ items, totalItems: total, skip: first, take: PAGE_TAKE });
  });
}

function locsOf(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '');
}

function tenantOnHost(primaryHost: string): VerifiedTenant {
  // Bypasses the schema on purpose: the escaping must hold whatever the store record carries.
  return tenantFixture({ ...storeFixture(), primaryHost });
}

beforeEach(() => {
  verifyTenant.mockReset();
  loadProductPage.mockReset();
  loadCollections.mockReset().mockResolvedValue([]);
  loadProduct.mockReset();
  loadCollectionPage.mockReset();
});

describe('seo routes', () => {
  it.each([
    ['sitemap', sitemapResponse],
    ['robots', robotsResponse],
  ] as const)(
    'answers the %s of an unverified tenant path with an empty 404 and no catalog read',
    async (_name, respond) => {
      // Arrange
      verifyTenant.mockResolvedValue(null);
      // Act
      const response = await respond(ROUTE);
      // Assert
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('');
      expect(loadCollections).not.toHaveBeenCalled();
      expect(loadProductPage).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['sitemap', sitemapResponse],
    ['robots', robotsResponse],
  ] as const)('answers the %s of the prerender sentinel with a 404 without verifying it', async (_name, respond) => {
    // Act
    const response = await respond(SENTINEL_ROUTE);
    // Assert
    expect(response.status).toBe(404);
    expect(verifyTenant).not.toHaveBeenCalled();
  });

  it('serves the sitemap of a verified tenant as cacheable XML', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(TENANT);
    catalogOf(1);
    // Act
    const response = await sitemapResponse(ROUTE);
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/xml; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
    expect(await response.text()).toContain('<loc>http://demo.localhost/product/p-0</loc>');
  });

  it('serves the robots.txt of a verified tenant as cacheable text', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(TENANT);
    // Act
    const response = await robotsResponse(ROUTE);
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await response.text()).toContain('Sitemap: http://demo.localhost/sitemap.xml');
  });
});

describe('sitemapXml', () => {
  it('lists at most SITEMAP_MAX_URLS URLs when the catalog has more products', async () => {
    // Arrange
    loadCollections.mockResolvedValue([collectionFixture()]);
    catalogOf(SITEMAP_MAX_URLS + 200);
    // Act
    const locs = locsOf(await sitemapXml(TENANT));
    // Assert
    expect(locs).toHaveLength(SITEMAP_MAX_URLS);
    expect(locs.slice(0, 3)).toEqual([
      'http://demo.localhost',
      'http://demo.localhost/products',
      'http://demo.localhost/category/kitchen',
    ]);
  });

  it('puts every URL on the primary host, over http for a *.localhost store', async () => {
    // Arrange
    loadCollections.mockResolvedValue([collectionFixture()]);
    catalogOf(30);
    // Act
    const locs = locsOf(await sitemapXml(TENANT));
    // Assert
    expect(locs).toHaveLength(2 + 1 + 30);
    expect(locs.every((loc) => loc === 'http://demo.localhost' || loc.startsWith('http://demo.localhost/'))).toBe(true);
  });

  it('puts every URL on the primary host over https for any other store', async () => {
    // Arrange
    catalogOf(3);
    // Act
    const locs = locsOf(await sitemapXml(tenantOnHost('shop.example.dz')));
    // Assert
    expect(locs.every((loc) => loc === 'https://shop.example.dz' || loc.startsWith('https://shop.example.dz/'))).toBe(
      true,
    );
  });

  it('XML-escapes ampersands, angle brackets and quotes in hosts and slugs', async () => {
    // Arrange
    loadProductPage.mockResolvedValue({
      items: [cardFixture({ slug: "it's" })],
      totalItems: 1,
      skip: 0,
      take: PAGE_TAKE,
    });
    // Act
    const xml = await sitemapXml(tenantOnHost('a&b<c>"d\'.example'));
    // Assert
    const locs = locsOf(xml);
    expect(locs[0]).toBe('https://a&amp;b&lt;c&gt;&quot;d&apos;.example');
    expect(locs.at(-1)).toBe('https://a&amp;b&lt;c&gt;&quot;d&apos;.example/product/it&apos;s');
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});

describe('robotsTxt', () => {
  it('disallows the buyer pages and points Sitemap at the primary host', () => {
    // Act
    const lines = robotsTxt(storeFixture({ primaryHost: 'shop.example.dz' })).split('\n');
    // Assert
    expect(lines).toEqual(
      expect.arrayContaining([
        'User-agent: *',
        'Disallow: /cart',
        'Disallow: /checkout',
        'Disallow: /success',
        'Disallow: /search',
        'Sitemap: https://shop.example.dz/sitemap.xml',
      ]),
    );
  });
});

describe('page metadata', () => {
  it('puts the canonical and og:url on the primary host', () => {
    // Act
    const metadata = storeMetadata(TENANT, { path: '/products', title: 'All products' });
    // Assert
    expect(metadata.alternates?.canonical).toBe('http://demo.localhost/products');
    expect(metadata.openGraph?.url).toBe('http://demo.localhost/products');
    expect(metadata.title).toBe('All products | Demo Store');
    expect(metadata.robots).toBeUndefined();
  });

  it('adds robots noindex to a page that is not indexable', () => {
    // Act
    const metadata = storeMetadata(TENANT, { path: '/cart', indexable: false });
    // Assert
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates?.canonical).toBe('http://demo.localhost/cart');
  });

  it('gives an unknown product slug the noindex metadata without the store name', async () => {
    // Arrange
    loadProduct.mockResolvedValue(null);
    // Act
    const metadata = await productPageMetadata(TENANT, 'gone');
    // Assert
    expect(metadata).toBe(NOINDEX_METADATA);
    expect(JSON.stringify(metadata)).not.toContain(TENANT.store.name);
  });

  it('gives a known product its own title and canonical URL', async () => {
    // Arrange
    loadProduct.mockResolvedValue(productFixture());
    // Act
    const metadata = await productPageMetadata(TENANT, 'scarf');
    // Assert
    expect(metadata.title).toBe('Wool Scarf | Demo Store');
    expect(metadata.alternates?.canonical).toBe('http://demo.localhost/product/scarf');
  });

  it('gives an unverified tenant the noindex metadata without running the page builder', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(null);
    const build = vi.fn(() => storeMetadata(TENANT, { path: '/' }));
    // Act
    const metadata = await tenantMetadata(Promise.resolve(ROUTE), build);
    // Assert
    expect(metadata).toBe(NOINDEX_METADATA);
    expect(build).not.toHaveBeenCalled();
    expect(JSON.stringify(metadata)).not.toContain(TENANT.store.name);
  });

  it('gives the prerender sentinel the noindex metadata without verifying it', async () => {
    // Arrange
    const build = vi.fn(() => storeMetadata(TENANT, { path: '/' }));
    // Act
    const metadata = await tenantMetadata(Promise.resolve(SENTINEL_ROUTE), build);
    // Assert
    expect(metadata).toBe(NOINDEX_METADATA);
    expect(verifyTenant).not.toHaveBeenCalled();
  });

  it('runs the page builder for a verified tenant', async () => {
    // Arrange
    verifyTenant.mockResolvedValue(TENANT);
    // Act
    const metadata = await tenantMetadata(Promise.resolve(ROUTE), (tenant) => storeMetadata(tenant, { path: '/' }));
    // Assert
    expect(metadata.alternates?.canonical).toBe('http://demo.localhost');
  });
});
