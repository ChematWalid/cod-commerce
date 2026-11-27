import { Logger } from '@vendure/core';
import type { StorefrontRevalidatorPort } from '../domain/ports/storefront-revalidator.port';

const LOG_CONTEXT = 'StorefrontRevalidate';

/**
 * {@link StorefrontRevalidatorPort} when `STOREFRONT_INTERNAL_URL` is unset (plugin tests, an api without a
 * storefront): logs what it would expire and succeeds, so the job does not retry; entries then expire by their
 * cache life (D3222).
 */
export class UnconfiguredStorefrontRevalidator implements StorefrontRevalidatorPort {
  revalidate(tags: readonly string[]): Promise<void> {
    Logger.warn(`No storefront to revalidate (STOREFRONT_INTERNAL_URL is unset): ${tags.join(', ')}`, LOG_CONTEXT);
    return Promise.resolve();
  }
}
