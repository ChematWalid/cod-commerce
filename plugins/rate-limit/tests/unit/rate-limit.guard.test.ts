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

  refund = () => Promise.reject(new Error('unused'));
  lockout = () => Promise.reject(new Error('unused'));
  isLocked = () => Promise.reject(new Error('unused'));
  clearLockout = () => Promise.reject(new Error('unused'));
}

const limitedHandler = (): void => undefined;
const unlimitedHandler = (): void => undefined;
Reflect.defineMetadata(RATE_LIMIT_METADATA, 'subdomain-ip', limitedHandler);

const restContext = (handler: () => void, request: object = { ip: '203.0.113.5', headers: {} }): ExecutionContext =>
  ({
    getHandler: () => handler,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  }) as unknown as ExecutionContext;

const guardWith = (limiter: RateLimiter): RateLimitGuard =>
  new RateLimitGuard(new Reflector(), limiter, new ClientIpResolver(''));

describe('RateLimitGuard', () => {
  it('consumes the handler policy, keyed by the client address, and lets an allowed request through', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: true, retryAfterSeconds: 0, exhausted: false });

    // Act
    const result = await guardWith(limiter).canActivate(restContext(limitedHandler));

    // Assert
    expect(result).toBe(true);
    expect(limiter.consumed).toEqual([['subdomain-ip', '203.0.113.5']]);
  });

  it('refuses with RATE_LIMITED and the wait when the limiter denies', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: false, retryAfterSeconds: 7, exhausted: true });

    // Act
    const attempt = guardWith(limiter).canActivate(restContext(limitedHandler));

    // Assert
    await expect(attempt).rejects.toThrow(RateLimitedError);
    await expect(attempt).rejects.toMatchObject({ code: 'RATE_LIMITED', extensions: { retryAfterSeconds: 7 } });
  });

  it('limits a signed render without a client address by its key id under storefront-render', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: true, retryAfterSeconds: 0, exhausted: false });
    const request = { ip: '10.0.0.7', headers: {}, internalAuth: { kid: 'storefront-1' } };

    // Act
    await guardWith(limiter).canActivate(restContext(limitedHandler, request));

    // Assert
    expect(limiter.consumed).toEqual([['storefront-render', 'internal:storefront-1']]);
  });

  it('limits a signed buyer request by the buyer address under the handler policy', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: true, retryAfterSeconds: 0, exhausted: false });
    const request = { ip: '10.0.0.7', headers: {}, internalAuth: { kid: 'storefront-1', clientIp: '198.51.100.4' } };

    // Act
    await guardWith(limiter).canActivate(restContext(limitedHandler, request));

    // Assert
    expect(limiter.consumed).toEqual([['subdomain-ip', '198.51.100.4']]);
  });

  it('ignores a handler without a policy', async () => {
    // Arrange
    const limiter = new RecordingLimiter({ allowed: false, retryAfterSeconds: 7, exhausted: true });

    // Act
    const result = await guardWith(limiter).canActivate(restContext(unlimitedHandler));

    // Assert
    expect(result).toBe(true);
    expect(limiter.consumed).toEqual([]);
  });
});
