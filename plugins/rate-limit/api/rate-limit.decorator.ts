import { applyDecorators, SetMetadata, UseFilters, UseGuards } from '@nestjs/common';
import type { RateLimitPolicyName } from '../domain/policies';
import { RATE_LIMIT_METADATA } from './rate-limit.metadata';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitedFilter } from './rate-limited.filter';

/**
 * Limits a REST handler or GraphQL resolver by client address under `policy`. The module that declares the
 * handler must import `RateLimitPlugin`, which provides what the guard needs.
 */
export function RateLimit(policy: RateLimitPolicyName): MethodDecorator {
  return applyDecorators(
    SetMetadata(RATE_LIMIT_METADATA, policy),
    UseGuards(RateLimitGuard),
    UseFilters(RateLimitedFilter),
  );
}
