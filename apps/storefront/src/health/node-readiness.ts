import type { HealthCheckResult, HealthProbeResponse } from '@cod/shared';

/** How long the node-level check waits for the node-local api's `/readyz` (ADR 0006 §12). */
export const NODE_READINESS_API_TIMEOUT_MS = 300;

/** The api answered, but not 200: it is draining or one of its dependencies is down. */
export const API_NOT_READY_REASON = 'api_not_ready';

/** The api did not answer within the timeout, refused the connection, or its URL is unusable. */
export const API_UNREACHABLE_REASON = 'api_unreachable';

const API_READYZ_PATH = '/readyz';
const HTTP_OK = 200;
const HTTP_UNAVAILABLE = 503;

/** The `api` check: a fixed reason on failure, never the api's body or the error text (anonymous callers). */
export interface NodeApiCheck extends HealthCheckResult {
  readonly reason?: typeof API_NOT_READY_REASON | typeof API_UNREACHABLE_REASON;
}

/** The `/api/readyz` body: the storefront answered (it is up) and the node-local api is ready. */
export type NodeReadiness = HealthProbeResponse<'storefront' | 'api'> & {
  readonly checks: { readonly api: NodeApiCheck };
};

/** The `/api/readyz` answer. */
export interface NodeReadinessAnswer {
  readonly statusCode: typeof HTTP_OK | typeof HTTP_UNAVAILABLE;
  readonly body: NodeReadiness;
}

async function checkApi(apiUrl: () => string, fetchApi: typeof fetch, timeoutMs: number): Promise<NodeApiCheck> {
  const startedAt = performance.now();
  const elapsed = (): number => Math.round(performance.now() - startedAt);
  try {
    const url = new URL(API_READYZ_PATH, apiUrl()).toString();
    const response = await fetchApi(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    await response.body?.cancel();
    if (response.status === HTTP_OK) return { ok: true, durationMs: elapsed() };
    return { ok: false, durationMs: elapsed(), reason: API_NOT_READY_REASON };
  } catch (error) {
    // Logged, not returned: the text can name a host, a port or a variable.
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'storefront.api_readyz.api_unreachable',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { ok: false, durationMs: elapsed(), reason: API_UNREACHABLE_REASON };
  }
}

/**
 * The node-level readiness the load balancer probes (`/api/readyz`, ADR 0012, infrastructure §2): the
 * storefront is up (it answers) and the api on the same node answers `/readyz` 200 within
 * {@link NODE_READINESS_API_TIMEOUT_MS}. Valkey is not required (the storefront serves uncached without it).
 *
 * @param apiUrl reads the node-local api's base URL (`INTERNAL_API_URL`); a throw counts as unreachable.
 */
export async function checkNodeReadiness(
  apiUrl: () => string,
  fetchApi: typeof fetch = fetch,
  timeoutMs: number = NODE_READINESS_API_TIMEOUT_MS,
): Promise<NodeReadinessAnswer> {
  const api = await checkApi(apiUrl, fetchApi, timeoutMs);
  const body: NodeReadiness = {
    status: api.ok ? 'ready' : 'not_ready',
    checks: { storefront: { ok: true, durationMs: 0 }, api },
  };
  return { statusCode: api.ok ? HTTP_OK : HTTP_UNAVAILABLE, body };
}
