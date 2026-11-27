import { REVALIDATE_TIMEOUT_MS } from '../domain/constants';
import type { CdnPurgePort } from '../domain/ports/cdn-purge.port';

/** Cloudflare's API root; the purge is `POST /zones/{zone}/purge_cache` with `{ "hosts": [...] }`. */
export const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';

/** Cloudflare refused or failed a purge. The message holds the status and error codes, never the token or a body. */
export class CloudflarePurgeFailedError extends Error {
  constructor(status: number, codes: readonly number[]) {
    const detail = codes.length === 0 ? '' : ` (error codes ${codes.join(', ')})`;
    super(`Cloudflare answered ${String(status)} to a purge${detail}`);
    this.name = 'CloudflarePurgeFailedError';
  }
}

/** The Cloudflare zone and the token the purge uses: a token limited to Cache Purge on that zone (D3210). */
export interface CloudflarePurgeTarget {
  readonly apiToken: string;
  readonly zoneId: string;
}

/** What {@link CloudflareCdnPurge} sends with; `fetch` is swapped in tests. */
export interface CloudflareCdnPurgeOptions extends CloudflarePurgeTarget {
  readonly fetch?: typeof fetch;
}

interface CloudflareEnvelope {
  readonly success?: unknown;
  readonly errors?: unknown;
}

const errorCodesOf = (envelope: CloudflareEnvelope): number[] =>
  Array.isArray(envelope.errors)
    ? envelope.errors.flatMap((error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
          ? [error.code]
          : [],
      )
    : [];

async function envelopeOf(response: Response): Promise<CloudflareEnvelope> {
  try {
    return (await response.json()) as CloudflareEnvelope;
  } catch (error: unknown) {
    if (error instanceof SyntaxError) return {};
    throw error;
  }
}

/**
 * {@link CdnPurgePort} over Cloudflare's purge-by-hostname API (D3210). A failure throws; the revalidation service
 * logs it and the pages still leave the CDN by their 60 s edge TTL.
 */
export class CloudflareCdnPurge implements CdnPurgePort {
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: CloudflareCdnPurgeOptions) {
    this.fetchFn = options.fetch ?? fetch;
  }

  async purgeHosts(hostnames: readonly string[]): Promise<void> {
    if (hostnames.length === 0) return;
    const response = await this.fetchFn(`${CLOUDFLARE_API_BASE}/zones/${this.options.zoneId}/purge_cache`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.options.apiToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ hosts: [...hostnames] }),
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });
    const envelope = await envelopeOf(response);
    if (!response.ok || envelope.success !== true) {
      throw new CloudflarePurgeFailedError(response.status, errorCodesOf(envelope));
    }
  }
}
