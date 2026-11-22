import { STOREFRONT_REVALIDATE_PATH } from '@cod/shared';
import { type InternalSigningKey, parseInternalKeys, signInternalRequest } from '@cod/shared/internal-auth';
import { describe, expect, it } from 'vitest';
import { handleRevalidate, REVALIDATE_MAX_BODY_BYTES } from '../../src/revalidate/handle-revalidate';

const KEYS = parseInternalKeys(
  'k1:change-me-internal-hmac-000000000000000000000,k2:change-me-internal-hmac-111111111111111111111',
);
const keyAt = (index: number): InternalSigningKey => {
  const key = KEYS[index];
  if (key === undefined) throw new Error('missing test key');
  return key;
};
const NOW_SECONDS = 1_800_000_000;
const URL_OF_ROUTE = `http://storefront:3001${STOREFRONT_REVALIDATE_PATH}`;
const STORE_TAG = 'store:7340032000000001';

function signedRequest(
  body: string,
  options: { key?: InternalSigningKey; at?: number; path?: string; sentBody?: string } = {},
): Request {
  const key = options.key ?? keyAt(1);
  const headers = signInternalRequest(
    { method: 'POST', pathWithQuery: options.path ?? STOREFRONT_REVALIDATE_PATH, body },
    key,
    options.at ?? NOW_SECONDS,
  );
  return new Request(URL_OF_ROUTE, { method: 'POST', headers, body: options.sentBody ?? body });
}

function setUp() {
  const revalidated: string[] = [];
  const logged: string[] = [];
  const deps = {
    keys: () => KEYS,
    nowSeconds: () => NOW_SECONDS,
    revalidate: (tag: string) => {
      revalidated.push(tag);
    },
    refused: (reason: string) => {
      logged.push(reason);
    },
  };
  return { revalidated, logged, run: (request: Request) => handleRevalidate(request, deps) };
}

const bodyOf = (tags: unknown): string => JSON.stringify({ tags });

describe('POST /api/internal/revalidate', () => {
  it('expires every tag of a signed request, under any configured key', async () => {
    // Arrange
    const { revalidated, run } = setUp();
    const body = bodyOf(['product:12', STORE_TAG]);

    // Act
    const withActive = await run(signedRequest(body));
    const withOld = await run(signedRequest(body, { key: keyAt(0) }));

    // Assert
    expect(withActive.status).toBe(200);
    expect(withOld.status).toBe(200);
    expect(revalidated).toEqual(['product:12', STORE_TAG, 'product:12', STORE_TAG]);
  });

  it('expires a repeated tag once', async () => {
    // Arrange
    const { revalidated, run } = setUp();

    // Act
    await run(signedRequest(bodyOf([STORE_TAG, STORE_TAG])));

    // Assert
    expect(revalidated).toEqual([STORE_TAG]);
  });

  it.each([
    ['unsigned', () => new Request(URL_OF_ROUTE, { method: 'POST', body: bodyOf([STORE_TAG]) })],
    [
      'signed with an unknown key',
      () => signedRequest(bodyOf([STORE_TAG]), { key: { kid: 'k9', secret: 'x'.repeat(40) } }),
    ],
    ['signed for another body', () => signedRequest(bodyOf([STORE_TAG]), { sentBody: bodyOf(['store:1']) })],
    ['signed for another path', () => signedRequest(bodyOf([STORE_TAG]), { path: '/api/store/products' })],
    ['expired', () => signedRequest(bodyOf([STORE_TAG]), { at: NOW_SECONDS - 3600 })],
  ])('answers an empty 404 to a request %s, and expires nothing', async (_name, request) => {
    // Arrange
    const { revalidated, logged, run } = setUp();

    // Act
    const response = await run(request());

    // Assert
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(revalidated).toEqual([]);
    expect(logged).toHaveLength(1);
  });

  it.each([
    ['a malformed tag', bodyOf(['product:../1'])],
    ['an unknown tag kind', bodyOf(['user:1'])],
    ['no tags', bodyOf([])],
    ['a body that is not JSON', '{tags'],
  ])('answers an empty 400 to a signed request with %s', async (_name, body) => {
    // Arrange
    const { revalidated, run } = setUp();

    // Act
    const response = await run(signedRequest(body));

    // Assert
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('');
    expect(revalidated).toEqual([]);
  });

  it('refuses a body over the limit before checking its signature', async () => {
    // Arrange
    const { revalidated, run } = setUp();
    const body = bodyOf([STORE_TAG]).padEnd(REVALIDATE_MAX_BODY_BYTES + 1, ' ');

    // Act
    const response = await run(signedRequest(body));

    // Assert
    expect(response.status).toBe(404);
    expect(revalidated).toEqual([]);
  });

  it('answers 404 and logs, without the secret, when the storefront keys are unusable', async () => {
    // Arrange
    const logged: string[] = [];
    const deps = {
      keys: () => {
        throw new Error('INTERNAL_HMAC_KEYS is required');
      },
      nowSeconds: () => NOW_SECONDS,
      revalidate: () => undefined,
      refused: (reason: string) => {
        logged.push(reason);
      },
    };

    // Act
    const response = await handleRevalidate(signedRequest(bodyOf([STORE_TAG])), deps);

    // Assert
    expect(response.status).toBe(404);
    expect(logged.join(' ')).not.toContain('change-me');
  });
});
