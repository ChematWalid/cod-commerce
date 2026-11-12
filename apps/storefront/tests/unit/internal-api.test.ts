import { INTERNAL_AUTH_HEADERS, parseInternalKeys, verifyInternalRequest } from '@cod/shared/internal-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontEnvError } from '../../src/config/storefront-env';
import { internalFetch } from '../../src/lib/internal-api';

const KEYS = 'k1:change-me-internal-hmac-000000000000000000000,k2:change-me-internal-hmac-111111111111111111111';
const NOW = new Date('2026-11-12T10:00:00Z');

describe('internalFetch', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const call = (): { url: URL; init: RequestInit; headers: Record<string, string> } => {
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    return {
      url: url as URL,
      init: init as RequestInit,
      headers: Object.fromEntries(new Headers((init as RequestInit).headers).entries()),
    };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('INTERNAL_API_URL', 'http://api.test:3000');
    vi.stubEnv('INTERNAL_HMAC_KEYS', KEYS);
    vi.stubEnv('INTERNAL_HMAC_ACTIVE_KID', 'k2');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('signs a GET so the api verifies it for the exact path and query', async () => {
    // Act
    await internalFetch('/store/resolve?host=demo.localhost');

    // Assert
    const { url, headers } = call();
    expect(url.href).toBe('http://api.test:3000/store/resolve?host=demo.localhost');
    expect(headers[INTERNAL_AUTH_HEADERS.kid]).toBe('k2');
    const verified = verifyInternalRequest(
      { method: 'GET', pathWithQuery: '/store/resolve?host=demo.localhost', body: '' },
      headers,
      parseInternalKeys(KEYS),
      NOW.getTime() / 1000,
    );
    expect(verified).toEqual({ ok: true, kid: 'k2' });
  });

  it('fails verification when the path differs from the signed one', async () => {
    // Act
    await internalFetch('/store/resolve?host=demo.localhost');

    // Assert
    const verified = verifyInternalRequest(
      { method: 'GET', pathWithQuery: '/store/resolve?host=other.localhost', body: '' },
      call().headers,
      parseInternalKeys(KEYS),
      NOW.getTime() / 1000,
    );
    expect(verified).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('signs the body as sent, with the store, client address and country', async () => {
    // Act
    await internalFetch('/store/intake', {
      method: 'POST',
      body: '{"a":1}',
      storeId: '100',
      clientIp: '203.0.113.7',
      clientCountry: 'DZ',
    });

    // Assert
    const { init, headers } = call();
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    const request = {
      method: 'POST',
      pathWithQuery: '/store/intake',
      body: '{"a":1}',
      storeId: '100',
      clientIp: '203.0.113.7',
      clientCountry: 'DZ',
    };
    const keys = parseInternalKeys(KEYS);
    expect(verifyInternalRequest(request, headers, keys, NOW.getTime() / 1000).ok).toBe(true);
    expect(verifyInternalRequest({ ...request, body: '{"a":2}' }, headers, keys, NOW.getTime() / 1000).ok).toBe(false);
    expect(headers[INTERNAL_AUTH_HEADERS.storeId]).toBe('100');
  });

  it('passes an abort signal that defaults to 3 seconds and can be overridden', async () => {
    // Arrange
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    // Act
    await internalFetch('/a');
    await internalFetch('/b', { timeoutMs: 500 });

    // Assert
    expect(timeout.mock.calls).toEqual([[3000], [500]]);
  });

  it('throws StorefrontEnvError, without the secret, when the active kid is missing', async () => {
    // Arrange
    vi.stubEnv('INTERNAL_HMAC_ACTIVE_KID', '');

    // Act
    const error = await internalFetch('/a').catch((caught: unknown) => caught);

    // Assert
    expect(error).toBeInstanceOf(StorefrontEnvError);
    expect((error as Error).message).toContain('INTERNAL_HMAC_ACTIVE_KID');
    expect((error as Error).message).not.toContain('change-me');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown active kid', { INTERNAL_HMAC_ACTIVE_KID: 'zz' }],
    ['short secret', { INTERNAL_HMAC_KEYS: 'k2:too-short' }],
    ['missing keys', { INTERNAL_HMAC_KEYS: '' }],
  ])('refuses a %s before any request', async (_name, env) => {
    // Arrange
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);

    // Act and Assert
    await expect(internalFetch('/a')).rejects.toThrow(StorefrontEnvError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
