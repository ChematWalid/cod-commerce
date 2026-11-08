import { describe, expect, it } from 'vitest';
import { toStorefrontReadiness } from '../../src/health/readiness';

describe('storefront readiness', () => {
  it('is ready with redis up', () => {
    // Arrange
    const redis = { ok: true, durationMs: 2 };
    // Act
    const readiness = toStorefrontReadiness(redis);
    // Assert
    expect(readiness).toEqual({ status: 'ready', checks: { redis: { ok: true, durationMs: 2 } } });
  });

  it('stays ready and reports redis down', () => {
    // Arrange
    const redis = { ok: false, durationMs: 500, error: 'PING timed out after 500 ms' };
    // Act
    const readiness = toStorefrontReadiness(redis);
    // Assert
    expect(readiness.status).toBe('ready');
    expect(readiness.checks.redis.ok).toBe(false);
  });
});
