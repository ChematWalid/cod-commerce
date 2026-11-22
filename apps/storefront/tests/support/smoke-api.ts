import { normalizeHost } from '@cod/shared';
import { parseInternalKeys, signInternalRequest, type InternalSigningKey } from '@cod/shared/internal-auth';
import { hostBindingOf } from '../../src/tenancy/host-binding';

/** The api the smoke run's storefront talks to (`INTERNAL_API_URL`). */
const API_URL = process.env['INTERNAL_API_URL'] ?? 'http://localhost:3100';
const MS_PER_SECOND = 1000;
/** The worker fills the projection from the seed's outbox events after it starts (D3205): the smoke waits for it. */
const PROJECTION_WAIT_MS = 90_000;
const POLL_MS = 1000;

/** One demo-seed store as the api answers it, with what its storefront lists. */
export interface SmokeStore {
  readonly storeId: string;
  readonly primaryHost: string;
  readonly productNames: readonly string[];
  /** A listed product's slug and name. */
  readonly productSlug: string;
  readonly productName: string;
}

/** The active signing key of the smoke environment, the one the storefront signs with. */
export function smokeSigningKey(): InternalSigningKey {
  const key = parseInternalKeys(process.env['INTERNAL_HMAC_KEYS'] ?? '').find(
    (candidate) => candidate.kid === process.env['INTERNAL_HMAC_ACTIVE_KID'],
  );
  if (key === undefined)
    throw new Error('INTERNAL_HMAC_KEYS and INTERNAL_HMAC_ACTIVE_KID must be set for the smoke run');
  return key;
}

/** A signed GET of the api, for `storeId` when given; throws unless it answers 2xx. */
async function signedApiGet(path: string, storeId?: string): Promise<unknown> {
  const covered = { method: 'GET', pathWithQuery: path, body: '', ...(storeId === undefined ? {} : { storeId }) };
  const headers = signInternalRequest(covered, smokeSigningKey(), Date.now() / MS_PER_SECOND);
  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) throw new Error(`${path} answered ${String(response.status)}: has the demo seed run?`);
  return response.json();
}

interface ListedProducts {
  readonly items: readonly { readonly slug: string; readonly name: string }[];
}

/** The store's listed products, once the projection holds any or the wait runs out. */
async function listedOnce(storeId: string): Promise<ListedProducts> {
  const deadline = Date.now() + PROJECTION_WAIT_MS;
  let listed = (await signedApiGet('/store/products?take=50', storeId)) as ListedProducts;
  while (listed.items.length === 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    listed = (await signedApiGet('/store/products?take=50', storeId)) as ListedProducts;
  }
  return listed;
}

/**
 * The demo-seed store of `primaryHost` and the products it lists, read from the api as the storefront reads them.
 *
 * @throws Error when the store is unknown or still lists nothing after the wait (the seed, or the worker that feeds
 * the projection, did not run)
 */
export async function smokeStoreOf(primaryHost: string): Promise<SmokeStore> {
  const resolved = (await signedApiGet(`/store/resolve?host=${primaryHost}`)) as { storeId: string };
  const listed = await listedOnce(resolved.storeId);
  const [product] = listed.items;
  if (product === undefined) throw new Error(`${primaryHost} lists no product: the projection is empty`);
  return {
    storeId: resolved.storeId,
    primaryHost,
    productNames: listed.items.map((item) => item.name),
    productSlug: product.slug,
    productName: product.name,
  };
}

/** The host binding the proxy would put in `store`'s tenant path on its own host (D3202). */
export function smokeBindingOf(store: Pick<SmokeStore, 'storeId' | 'primaryHost'>): string {
  const host = normalizeHost(store.primaryHost);
  if (host === null) throw new Error('a demo store has no primary host');
  return hostBindingOf(smokeSigningKey(), store.storeId, host);
}
