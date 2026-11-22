import { STOREFRONT_REVALIDATE_PATH, type StorefrontRevalidateBody } from '@cod/shared';
import { type InternalSigningKey, signInternalRequest } from '@cod/shared/internal-auth';
import { REVALIDATE_TIMEOUT_MS } from '../domain/constants';
import type { StorefrontRevalidatorPort } from '../domain/ports/storefront-revalidator.port';

const MS_PER_SECOND = 1000;
const METHOD = 'POST';

/** The storefront did not confirm a revalidation: the job retries. The message holds the status, never a body. */
export class StorefrontRevalidateFailedError extends Error {
  constructor(status: number) {
    super(`The storefront answered ${String(status)} to a revalidation`);
    this.name = 'StorefrontRevalidateFailedError';
  }
}

/** What {@link HttpStorefrontRevalidator} sends with. */
export interface HttpStorefrontRevalidatorOptions {
  /** `STOREFRONT_INTERNAL_URL`: the storefront as the api reaches it, without the route. */
  readonly baseUrl: string;
  /** The active internal key (`INTERNAL_HMAC_ACTIVE_KID`); the storefront verifies with its key list (D3211). */
  readonly signingKey: InternalSigningKey;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}

/**
 * {@link StorefrontRevalidatorPort} over the storefront's signed `POST /api/internal/revalidate` (D3211). The
 * signature (`cod-internal-v1`, ADR 0008) covers the method, the path and the body, so the route trusts the tags.
 */
export class HttpStorefrontRevalidator implements StorefrontRevalidatorPort {
  private readonly url: URL;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly options: HttpStorefrontRevalidatorOptions) {
    this.url = new URL(STOREFRONT_REVALIDATE_PATH, options.baseUrl);
    this.fetchFn = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async revalidate(tags: readonly string[]): Promise<void> {
    const payload: StorefrontRevalidateBody = { tags: [...tags] };
    const body = JSON.stringify(payload);
    const signed = signInternalRequest(
      { method: METHOD, pathWithQuery: `${this.url.pathname}${this.url.search}`, body },
      this.options.signingKey,
      this.now() / MS_PER_SECOND,
    );
    const response = await this.fetchFn(this.url.toString(), {
      method: METHOD,
      headers: { ...signed, 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
    });
    if (!response.ok) throw new StorefrontRevalidateFailedError(response.status);
  }
}
