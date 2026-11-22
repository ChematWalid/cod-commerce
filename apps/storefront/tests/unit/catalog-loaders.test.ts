import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardFixture, collectionFixture, productFixture, tenantFixture } from '../support/storefront-fixtures';

const cacheTag = vi.fn<(...tags: string[]) => void>();
vi.mock('next/cache', () => ({ cacheTag, cacheLife: vi.fn() }));

const { CatalogApiError } = await import('../../src/catalog/catalog-api');
const { loadCollectionPage, loadCollections, loadProduct, loadProductPage, searchProducts } =
  await import('../../src/catalog/catalog-loaders');

const TENANT = tenantFixture();
const PAGE = { items: [cardFixture()], totalItems: 1, skip: 0, take: 24 };

describe('catalog loaders', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const requested = (): URL => fetchMock.mock.calls[0]?.[0] as URL;
  const requestHeaders = (): Headers => new Headers(fetchMock.mock.calls[0]?.[1]?.headers);

  beforeEach(() => {
    fetchMock.mockReset();
    cacheTag.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test:3000');
    vi.stubEnv('INTERNAL_HMAC_KEYS', 'k1:change-me-internal-hmac-000000000000000000000');
    vi.stubEnv('INTERNAL_HMAC_ACTIVE_KID', 'k1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('reads a listing page as the verified store, signed, and tags it with the store and its products', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(PAGE));
    // Act
    const page = await loadProductPage(TENANT, { page: 2, sort: 'price-desc' });
    // Assert
    expect(page.items[0]?.slug).toBe('kettle');
    expect(requested().pathname + requested().search).toBe('/store/products?skip=24&take=24&sort=price-desc');
    expect(requestHeaders().get('x-store-id')).toBe(TENANT.storeId);
    expect(cacheTag.mock.calls.flat()).toEqual(expect.arrayContaining(['store:1001', 'product:5001']));
  });

  it('maps a collection preview, an absolute URL, to the storage path product images use', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json({ items: [collectionFixture()] }));
    // Act
    const collections = await loadCollections(TENANT);
    // Assert
    expect(collections[0]?.imagePath).toBe('b/1/s/1001/preview/kitchen.jpg');
    expect(cacheTag.mock.calls.flat()).toContain('collection:7001');
  });

  it('reads a product by its encoded slug and tags it with the product and the store offers', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(productFixture()));
    // Act
    const product = await loadProduct(TENANT, 'scarf');
    // Assert
    expect(product?.variants).toHaveLength(2);
    expect(requested().pathname).toBe('/store/product/scarf');
    expect(cacheTag.mock.calls.flat()).toEqual(expect.arrayContaining(['product:5002', 'offers:1001']));
  });

  it.each(['../shop-api', 'a/b', 'A', 'a%2Fb', ''])(
    'answers no product for the slug %j without an api call',
    async (slug) => {
      await expect(loadProduct(TENANT, slug)).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('answers no product for a 404', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    await expect(loadProduct(TENANT, 'gone')).resolves.toBeNull();
  });

  it('throws the typed error on a 500 or an unexpected shape, so an outage is never an empty store', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(loadProductPage(TENANT, { page: 1, sort: 'newest' })).rejects.toThrow(CatalogApiError);
    fetchMock.mockResolvedValueOnce(Response.json({ items: 'nope' }));
    await expect(loadProductPage(TENANT, { page: 1, sort: 'newest' })).rejects.toThrow(CatalogApiError);
  });

  it('reads a collection page with its listing query', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json({ collection: collectionFixture(), products: PAGE }));
    // Act
    const page = await loadCollectionPage(TENANT, 'kitchen', { page: 1, sort: 'newest' });
    // Assert
    expect(page?.collection.imagePath).toBe('b/1/s/1001/preview/kitchen.jpg');
    expect(requested().pathname + requested().search).toBe('/store/collection/kitchen?skip=0&take=24&sort=newest');
  });

  it('runs a search per request, never tagging a cache entry, and skips a query too short to run', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(PAGE));
    // Act
    const short = await searchProducts(TENANT, { q: 'a', page: 1 });
    const found = await searchProducts(TENANT, { q: 'kettle', page: 1 });
    // Assert
    expect(short.items).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(requested().searchParams.get('q')).toBe('kettle');
    expect(found.items).toHaveLength(1);
    expect(cacheTag).not.toHaveBeenCalled();
  });

  it('signs the buyer address into a search so the api limits it per buyer, not per store', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(PAGE));
    // Act
    await searchProducts(TENANT, { q: 'kettle', page: 1 }, '203.0.113.10');
    // Assert
    expect(requestHeaders().get('x-client-ip')).toBe('203.0.113.10');
    expect(requestHeaders().get('x-store-id')).toBe(TENANT.storeId);
  });

  it('sends no buyer address on a search when none is known', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(PAGE));
    // Act
    await searchProducts(TENANT, { q: 'kettle', page: 1 });
    // Assert
    expect(requestHeaders().get('x-client-ip')).toBeNull();
  });
});
