import { STOREFRONT_REVALIDATE_PATH } from '@cod/shared';
import { type InternalSigningKey, verifyInternalRequest } from '@cod/shared/internal-auth';
import { describe, expect, it } from 'vitest';
import {
  HttpStorefrontRevalidator,
  StorefrontRevalidateFailedError,
} from '../../infrastructure/http-storefront-revalidator';

const KEY: InternalSigningKey = { kid: 'k1', secret: 'change-me-internal-hmac-000000000000000000000' };
const NOW_MS = 1_800_000_000_000;

interface SentRequest {
  readonly url: string;
  readonly init: RequestInit;
}

function setUp(status = 204) {
  const sent: SentRequest[] = [];
  const fetchFn = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    sent.push({ url: url instanceof Request ? url.url : url.toString(), init: init ?? {} });
    return Promise.resolve(new Response(null, { status }));
  };
  const revalidator = new HttpStorefrontRevalidator({
    baseUrl: 'http://storefront:3001',
    signingKey: KEY,
    fetch: fetchFn,
    now: () => NOW_MS,
  });
  return { sent, revalidator };
}

describe('HttpStorefrontRevalidator', () => {
  it('posts the tags to the storefront revalidate route, signed with the internal key', async () => {
    // Arrange
    const { sent, revalidator } = setUp();

    // Act
    await revalidator.revalidate(['product:12', 'store:7340032000000001']);

    // Assert
    expect(sent).toHaveLength(1);
    const [request] = sent;
    expect(request?.url).toBe(`http://storefront:3001${STOREFRONT_REVALIDATE_PATH}`);
    expect(request?.init.method).toBe('POST');
    const body = typeof request?.init.body === 'string' ? request.init.body : '';
    expect(JSON.parse(body)).toEqual({ tags: ['product:12', 'store:7340032000000001'] });
    const headers = request?.init.headers as Record<string, string>;
    const verified = verifyInternalRequest(
      { method: 'POST', pathWithQuery: STOREFRONT_REVALIDATE_PATH, body },
      headers,
      [KEY],
      NOW_MS / 1000,
    );
    expect(verified).toEqual({ ok: true, kid: 'k1' });
    expect(headers['content-type']).toBe('application/json');
  });

  it('fails on a refusal so the job retries, naming only the status', async () => {
    // Arrange
    const { revalidator } = setUp(404);

    // Act
    const run = revalidator.revalidate(['store:7340032000000001']);

    // Assert
    await expect(run).rejects.toBeInstanceOf(StorefrontRevalidateFailedError);
    await expect(run).rejects.toThrow('404');
  });
});
