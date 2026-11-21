import { RateLimiter, type RateLimitPolicyName } from '@cod/plugin-rate-limit';
import type { BusinessId } from '@cod/shared';
import { Injectable } from '@nestjs/common';
import { CollectionsRateLimitedError } from '../domain/errors';

/**
 * Caps the rule previews and builder-option reads one administrator can run (D2338): each one reads the whole store,
 * and the dashboard's 400 ms debounce binds only our own client. Over the limit answers `collections.rate-limited`
 * (429 with `Retry-After` on REST, `extensions.retryAfterSeconds` on GraphQL).
 */
@Injectable()
export class CollectionsThrottle {
  constructor(private readonly limiter: RateLimiter) {}

  /** @throws {CollectionsRateLimitedError} past the administrator's preview budget. */
  spendPreview(businessId: BusinessId, administratorKey: string): Promise<void> {
    return this.spend('collections-preview-actor', businessId, administratorKey);
  }

  /** @throws {CollectionsRateLimitedError} past the administrator's builder-option budget. */
  spendRuleOptions(businessId: BusinessId, administratorKey: string): Promise<void> {
    return this.spend('collections-rule-options-actor', businessId, administratorKey);
  }

  private async spend(policy: RateLimitPolicyName, businessId: BusinessId, administratorKey: string): Promise<void> {
    // An administrator acts for one business, but its id says which one only with the business.
    const decision = await this.limiter.consume(policy, `${businessId}:${administratorKey}`);
    if (!decision.allowed) throw new CollectionsRateLimitedError(decision.retryAfterSeconds);
  }
}
