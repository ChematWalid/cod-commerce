import { RateLimitedError, RateLimiter, type RateLimitPolicyName } from '@cod/plugin-rate-limit';
import type { BusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';

/** Caps the media uploads one administrator and one business can write to the shared bucket (D2138). */
@Injectable()
export class MediaThrottle {
  constructor(private readonly limiter: RateLimiter) {}

  /**
   * The narrower actor budget is spent first, so one administrator past its own cap is refused before its calls can
   * drain the budget the whole business shares.
   *
   * @throws RateLimitedError (429) past the actor's or the business's upload budget.
   */
  async spendUpload(businessId: BusinessId, administratorKey: string): Promise<void> {
    // An administrator acts for one business, but its id says which one only with the business.
    await this.spend('catalog-media-actor', `${businessId}:${administratorKey}`);
    await this.spend('catalog-media-business', businessId);
  }

  private async spend(policy: RateLimitPolicyName, key: string): Promise<void> {
    const decision = await this.limiter.consume(policy, key);
    if (!decision.allowed) throw new RateLimitedError(decision.retryAfterSeconds);
  }
}
