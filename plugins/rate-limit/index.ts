export { type ClientRequest, ClientIpResolver } from './api/client-ip.resolver';
export { RateLimit } from './api/rate-limit.decorator';
export { RateLimitGuard } from './api/rate-limit.guard';
export { RateLimitedError } from './api/rate-limited.error';
export { RateLimitedFilter } from './api/rate-limited.filter';
export { RATE_LIMITED_CODE } from './domain/constants';
export type { LockoutStatus, RateLimitDecision } from './domain/decision';
export {
  RATE_LIMIT_POLICIES,
  type OutageMode,
  type RateLimitPolicy,
  type RateLimitPolicyName,
} from './domain/policies';
export { RateLimiter } from './domain/rate-limiter';
export { RateLimitPlugin, type RateLimitPluginOptions } from './rate-limit.plugin';
