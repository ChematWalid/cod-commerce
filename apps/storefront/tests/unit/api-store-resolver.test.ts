import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontEnvError } from '../../src/config/storefront-env';
import { ApiStoreResolver, StoreResolverError } from '../../src/tenancy/api-store-resolver';
import type { NormalizedHost } from '../../src/tenancy/host';
import { InvalidStoreLocaleError } from '../../src/tenancy/store-locale';

const HOST = 'demo.localhost' as NormalizedHost;
const BODY = {
  storeId: '100',
  businessId: '200',
  language: 'ar',
  name: 'Demo Store',
  logo: null,
  primaryHost: 'demo.localhost',
  status: 'active',
};

describe('ApiStoreResolver', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const requestedUrl = (): string => (fetchMock.mock.calls[0]?.[0] as URL).href;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test:3000');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('maps a 200 to a resolved store, the language becoming the default locale', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(BODY));

    // Act
    const store = await new ApiStoreResolver().resolveByHost(HOST);

    // Assert
    expect(store).toEqual({
      storeId: '100',
      businessId: '200',
      name: 'Demo Store',
      logo: null,
      defaultLocale: 'ar',
      primaryHost: 'demo.localhost',
      status: 'active',
    });
    expect(requestedUrl()).toBe('http://api.test:3000/store/resolve?host=demo.localhost');
  });

  it('finds a store by id through the by-id route', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json(BODY));

    // Act
    await new ApiStoreResolver().findById('100');

    // Assert
    expect(requestedUrl()).toBe('http://api.test:3000/store/by-id/100');
  });

  it('maps a 404 to null', async () => {
    // Arrange
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));

    // Act and Assert
    await expect(new ApiStoreResolver().resolveByHost(HOST)).resolves.toBeNull();
  });

  it('throws on a 500, so an outage is not a missing store', async () => {
    // Arrange
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));

    // Act and Assert
    await expect(new ApiStoreResolver().resolveByHost(HOST)).rejects.toThrow(StoreResolverError);
  });

  it('lets a network failure through', async () => {
    // Arrange
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    // Act and Assert
    await expect(new ApiStoreResolver().resolveByHost(HOST)).rejects.toThrow('fetch failed');
  });

  it('rejects a body that is not a store', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json({ storeId: 1 }));

    // Act and Assert
    await expect(new ApiStoreResolver().resolveByHost(HOST)).rejects.toThrow(StoreResolverError);
  });

  it('rejects a language the platform does not offer', async () => {
    // Arrange
    fetchMock.mockResolvedValue(Response.json({ ...BODY, language: 'de' }));

    // Act and Assert
    await expect(new ApiStoreResolver().resolveByHost(HOST)).rejects.toThrow(InvalidStoreLocaleError);
  });

  it('reads INTERNAL_API_URL at call time and throws when it is missing', async () => {
    // Arrange: the resolver is constructed before the variable is removed, as during next build.
    const resolver = new ApiStoreResolver();
    vi.stubEnv('INTERNAL_API_URL', '');

    // Act and Assert
    await expect(resolver.resolveByHost(HOST)).rejects.toThrow('INTERNAL_API_URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a malformed INTERNAL_API_URL with the typed env error, before any request', async () => {
    // Arrange
    vi.stubEnv('INTERNAL_API_URL', 'api.test:3000');

    // Act and Assert
    await expect(new ApiStoreResolver().resolveByHost(HOST)).rejects.toThrow(StorefrontEnvError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
