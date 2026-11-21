import { RateLimitedError, RateLimiter } from '@cod/plugin-rate-limit';
import type { BusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';

/** Caps the pack previews one administrator can run: each one reads up to ten products (D2217). */
@Injectable()
export class PackThrottle {
  constructor(private readonly limiter: RateLimiter) {}

  /** @throws RateLimitedError (429) past the actor's preview budget. */
  async spendPreview(businessId: BusinessId, administratorKey: string): Promise<void> {
    // An administrator acts for one business, but its id says which one only with the business.
    const decision = await this.limiter.consume('catalog-pack-preview-actor', `${businessId}:${administratorKey}`);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
  }
}
