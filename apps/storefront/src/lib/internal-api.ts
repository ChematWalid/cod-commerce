import { signInternalRequest } from '@cod/shared/internal-auth';
import { internalApiUrl, internalSigningKey } from '../config/storefront-env';

/** How long a call waits for the API before failing, unless the caller says otherwise. */
const DEFAULT_TIMEOUT_MS = 3000;
const MS_PER_SECOND = 1000;

/** What `internalFetch` sends besides the path. The client address and country are for intake (P3.S4). */
export interface InternalFetchInit {
  readonly method?: 'GET' | 'POST';
  /** Signed as sent: the same string goes on the wire. */
  readonly body?: string;
  readonly storeId?: string;
  readonly clientIp?: string;
  readonly clientCountry?: string;
  readonly timeoutMs?: number;
}

/**
 * Calls the API as the storefront: the request carries the `x-internal-*` headers the api's internal-only guard
 * verifies (ADR 0008, D111). The URL and the key are read on every call (never at load: `next build` evaluates
 * this module), and a missing or invalid one throws before any request.
 *
 * @param path the path with its query, exactly as the api will see it
 * @throws StorefrontEnvError when `INTERNAL_API_URL`, the keys or the active kid are missing or invalid
 */
export async function internalFetch(path: string, init: InternalFetchInit = {}): Promise<Response> {
  const url = new URL(path, internalApiUrl());
  const key = internalSigningKey();
  const method = init.method ?? 'GET';
  const body = init.body ?? '';
  const headers = signInternalRequest(
    {
      method,
      pathWithQuery: `${url.pathname}${url.search}`,
      body,
      ...(init.storeId !== undefined && { storeId: init.storeId }),
      ...(init.clientIp !== undefined && { clientIp: init.clientIp }),
      ...(init.clientCountry !== undefined && { clientCountry: init.clientCountry }),
    },
    key,
    Date.now() / MS_PER_SECOND,
  );
  return await fetch(url, {
    method,
    headers,
    ...(init.body !== undefined && { body: init.body }),
    signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
}
