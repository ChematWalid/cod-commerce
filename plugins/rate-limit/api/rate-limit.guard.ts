import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { parseContext } from '@vendure/core';
import type { RateLimitPolicyName } from '../domain/policies';
import { RateLimiter } from '../domain/rate-limiter';
import { ClientIpResolver } from './client-ip.resolver';
import { RATE_LIMIT_METADATA } from './rate-limit.metadata';
import { RateLimitedError } from './rate-limited.error';

/** Takes a token for the policy named by `@RateLimit`, keyed by the client's address, and refuses when none is left. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
    private readonly clientIps: ClientIpResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<RateLimitPolicyName | undefined>(RATE_LIMIT_METADATA, context.getHandler());
    if (policy === undefined) {
      return true;
    }
    const { req } = parseContext(context);
    const decision = await this.limiter.consume(policy, this.clientIps.resolve(req));
    if (!decision.allowed) {
      throw new RateLimitedError(decision.retryAfterSeconds);
    }
    return true;
  }
}
