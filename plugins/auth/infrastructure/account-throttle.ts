import { ClientIpResolver, type ClientRequest, RateLimitedError, RateLimiter } from '@cod/plugin-rate-limit';
import { normalizeEmail } from '@cod/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { RequestContext } from '@vendure/core';
import { SECRET_HASHER } from '../application/tokens';
import { loginEmailKey, loginPairKey } from '../domain/login-throttle-keys';
import type { AccountLimitPolicy, AccountThrottlePort } from '../domain/ports/account-credentials.port';
import type { OperationContext } from '../domain/ports/operation-context';
import type { SecretHasherPort } from '../domain/ports/secret-hasher.port';

const NO_CLIENT: ClientRequest = { ip: undefined, headers: {} };

/** {@link AccountThrottlePort} on the shared limiter. An email only ever appears in a key as its HMAC. */
@Injectable()
export class AccountThrottle implements AccountThrottlePort {
  constructor(
    private readonly limiter: RateLimiter,
    private readonly clientIp: ClientIpResolver,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasherPort,
  ) {}

  spendForEmail(policy: AccountLimitPolicy, email: string): Promise<void> {
    return this.spend(policy, loginEmailKey(this.hasher, normalizeEmail(email)));
  }

  spendForUser(policy: AccountLimitPolicy, userId: number): Promise<void> {
    return this.spend(policy, String(userId));
  }

  async clearLoginLockout(ctx: OperationContext, email: string): Promise<void> {
    const ip = this.clientIp.resolve((ctx as unknown as RequestContext).req ?? NO_CLIENT);
    await this.limiter.clearLockout(loginPairKey(loginEmailKey(this.hasher, normalizeEmail(email)), ip));
  }

  private async spend(policy: AccountLimitPolicy, key: string): Promise<void> {
    const decision = await this.limiter.consume(policy, key);
    if (!decision.allowed) {
      throw new RateLimitedError(decision.retryAfterSeconds);
    }
  }
}
