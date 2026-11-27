import { describe, expect, it } from 'vitest';
import { CloudflareCdnPurge, CloudflarePurgeFailedError } from '../../infrastructure/cloudflare-cdn-purge.adapter';
import { NoopCdnPurge } from '../../infrastructure/noop-cdn-purge.adapter';
import { cdnPurgeOf } from '../../infrastructure/revalidation.providers';

// Synthetic values: a test token that grants nothing, and a zone id of the right shape.
const TOKEN = 'test-token-not-a-real-cloudflare-token';
const ZONE = '0123456789abcdef0123456789abcdef';

interface SentRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function setUp(status: number, body: unknown) {
  const sent: SentRequest[] = [];
  const fetchFn = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { sent, purge: new CloudflareCdnPurge({ apiToken: TOKEN, zoneId: ZONE, fetch: fetchFn }) };
}

describe('CloudflareCdnPurge', () => {
  it('purges the hostnames of the zone in one request with the bearer token', async () => {
    // Arrange
    const { sent, purge } = setUp(200, { success: true, errors: [] });

    // Act
    await purge.purgeHosts(['shop-a.example.dz', 'www.shop-a.dz']);

    // Assert
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(`https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache`);
    expect(sent[0]?.init.method).toBe('POST');
    expect((sent[0]?.init.headers as Record<string, string>)['authorization']).toBe(`Bearer ${TOKEN}`);
    const body = sent[0]?.init.body;
    expect(JSON.parse(typeof body === 'string' ? body : '')).toEqual({ hosts: ['shop-a.example.dz', 'www.shop-a.dz'] });
  });

  it('sends nothing for an empty list', async () => {
    // Arrange
    const { sent, purge } = setUp(200, { success: true });

    // Act
    await purge.purgeHosts([]);

    // Assert
    expect(sent).toHaveLength(0);
  });

  it('throws with the status and error codes, never the token, when Cloudflare refuses', async () => {
    // Arrange
    const { purge } = setUp(403, { success: false, errors: [{ code: 10000, message: 'Authentication error' }] });

    // Act
    const failure = purge.purgeHosts(['shop-a.example.dz']);

    // Assert
    await expect(failure).rejects.toBeInstanceOf(CloudflarePurgeFailedError);
    await expect(failure).rejects.toThrow('Cloudflare answered 403 to a purge (error codes 10000)');
    await expect(failure).rejects.not.toThrow(TOKEN);
  });

  it('throws when a 200 answer does not report success', async () => {
    // Arrange
    const { purge } = setUp(200, { success: false, errors: [] });

    // Act
    const failure = purge.purgeHosts(['shop-a.example.dz']);

    // Assert
    await expect(failure).rejects.toThrow('Cloudflare answered 200 to a purge');
  });
});

describe('cdnPurgeOf', () => {
  it('picks the Cloudflare purge when the host gives a zone and a token', () => {
    // Act
    const purge = cdnPurgeOf({ cloudflare: { apiToken: TOKEN, zoneId: ZONE } });

    // Assert
    expect(purge).toBeInstanceOf(CloudflareCdnPurge);
  });

  it('keeps the logging no-op without them', () => {
    // Act
    const purge = cdnPurgeOf({});

    // Assert
    expect(purge).toBeInstanceOf(NoopCdnPurge);
  });
});
