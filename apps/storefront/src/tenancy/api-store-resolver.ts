import { readInternalApiUrl } from '../config/storefront-env';
import { normalizeHost, type NormalizedHost } from './host';
import { toStoreLocale } from './store-locale';
import type { ResolvedStore, StoreResolver } from './store-resolver';

/** How long the proxy waits for the API before failing the request. */
const API_TIMEOUT_MS = 3000;
const NOT_FOUND = 404;

/** The API could not say whether the store exists: not a 404, so an outage is never shown as an unknown store. */
export class StoreResolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreResolverError';
  }
}

/** The body of `GET /store/resolve` and `GET /store/by-id/:storeId`. */
interface StoreResponse {
  readonly storeId: string;
  readonly businessId: string;
  readonly language: string;
  readonly name: string;
  readonly logo: string | null;
  readonly primaryHost: string;
  readonly status: string;
}

function isStoreResponse(body: unknown): body is StoreResponse {
  if (typeof body !== 'object' || body === null) return false;
  const fields = body as Record<string, unknown>;
  const strings = ['storeId', 'businessId', 'language', 'name', 'primaryHost', 'status'];
  return strings.every((key) => typeof fields[key] === 'string');
}

function toResolvedStore(body: unknown): ResolvedStore {
  if (!isStoreResponse(body)) throw new StoreResolverError('the API answered with an unexpected store shape');
  const primaryHost: NormalizedHost | null = normalizeHost(body.primaryHost);
  if (primaryHost === null) throw new StoreResolverError(`store ${body.storeId} has no primary host`);
  return {
    storeId: body.storeId,
    businessId: body.businessId,
    name: body.name,
    logo: body.logo,
    defaultLocale: toStoreLocale(body.language),
    primaryHost,
    status: body.status === 'active' ? 'active' : 'disabled',
  };
}

/** Finds stores through the API, which owns the caches and their invalidation (D12). */
export class ApiStoreResolver implements StoreResolver {
  /** @throws StoreResolverError or a network error when the API cannot answer; StorefrontEnvError without a usable `INTERNAL_API_URL` */
  resolveByHost(host: NormalizedHost): Promise<ResolvedStore | null> {
    return this.fetchStore(`/store/resolve?host=${encodeURIComponent(host)}`);
  }

  /** @throws StoreResolverError or a network error when the API cannot answer */
  findById(storeId: string): Promise<ResolvedStore | null> {
    return this.fetchStore(`/store/by-id/${encodeURIComponent(storeId)}`);
  }

  private async fetchStore(path: string): Promise<ResolvedStore | null> {
    // Read per call, not at module load: this module is evaluated during `next build`, where the API does not exist.
    const apiUrl = readInternalApiUrl(process.env);
    const response = await fetch(new URL(path, apiUrl), { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (response.status === NOT_FOUND) return null;
    if (!response.ok) throw new StoreResolverError(`GET ${path} answered ${String(response.status)}`);
    return toResolvedStore(await response.json());
  }
}
