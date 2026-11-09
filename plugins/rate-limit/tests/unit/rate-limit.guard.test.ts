import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ClientIpResolver } from '../../api/client-ip.resolver';
import { RATE_LIMIT_METADATA } from '../../api/rate-limit.metadata';
import { RateLimitGuard } from '../../api/rate-limit.guard';
import { RateLimitedError } from '../../api/rate-limited.error';
import type { RateLimitDecision } from '../../domain/decision';
import type { RateLimitPolicyName } from '../../domain/policies';
import { RateLimiter } from '../../domain/rate-limiter';

class RecordingLimiter extends RateLimiter {
  readonly consumed: [RateLimitPolicyName, string][] = [];

  constructor(private readonly decision: RateLimitDecision) {
    super();
  }

  consume(policy: RateLimitPolicyName, key: string): Promise<RateLimitDecision> {
    this.consumed.push([policy, key]);
    return Promise.resolve(this.decision);
  }

  lockout = () => Promise.reject(new Error('unused'));
  isLocked = () => Promise.reject(new Error('unused'));
  clearLockout = () => Promise.reject(new Error('unused'));
}

const limitedHandler = (): void => undefined;
const unlimitedHandler = (): void => undefined;
Reflect.defineMetadata(RATE_LIMIT_METADATA, 'subdomain-ip', limitedHandler);

const restContext = (handler: () => void): ExecutionContext =>
  ({
    getHandler: () => handler,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ ip: '203.0.113.5', headers: {} }), getResponse: () => ({}) }),
  }) as unknown as ExecutionContext;

const guardWith = (limiter: RateLimiter): RateLimitGuard =>
  new RateLimitGuard(new Reflector(), limiter, new ClientIpResolver(''));

describe('RateLimitGuard', () => {
  it('consumes the handler policy, keyed by the client address, and lets an allowed request through', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: true, retryAfterSeconds: 0 });

    // Act
    const result = await guardWith(limiter).canActivate(restContext(limitedHandler));

    // Assert
    expect(result).toBe(true);
    expect(limiter.consumed).toEqual([['subdomain-ip', '203.0.113.5']]);
  });

  it('refuses with RATE_LIMITED and the wait when the limiter denies', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: false, retryAfterSeconds: 7 });

    // Act
    const attempt = guardWith(limiter).canActivate(restContext(limitedHandler));

    // Assert
    await expect(attempt).rejects.toThrow(RateLimitedError);
    await expect(attempt).rejects.toMatchObject({ code: 'RATE_LIMITED', extensions: { retryAfterSeconds: 7 } });
  });

  it('ignores a handler without a policy', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: false, retryAfterSeconds: 7 });

    // Act
    const result = await guardWith(limiter).canActivate(restContext(unlimitedHandler));

    // Assert
    expect(result).toBe(true);
    expect(limiter.consumed).toEqual([]);
  });
});
