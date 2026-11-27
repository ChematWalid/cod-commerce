import { afterEach, describe, expect, it, vi } from 'vitest';
import { toStorefrontReadiness } from '../../src/health/readiness';
import { CACHE_UNREACHABLE_REASON, pingRedis } from '../../src/health/redis-ping';

describe('readiness ping', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a failing probe as cache_unreachable, with the error text in the log only', async () => {
    // Arrange
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const secret = 'WRONGPASS invalid password for user cache-7f3a';
    const probe = (): Promise<unknown> => Promise.reject(new Error(secret));
    // Act
    const body = JSON.stringify(toStorefrontReadiness(await pingRedis(probe)));
    // Assert
    expect(JSON.parse(body)).toMatchObject({
      status: 'ready',
      checks: { redis: { ok: false, reason: 'cache_unreachable' } },
    });
    expect(body).not.toContain(secret);
    expect(body).not.toContain('"error"');
    expect(warn.mock.calls.flat().join(' ')).toContain(secret);
  });

  it('reports a probe that never answers as cache_unreachable after the timeout', async () => {
    // Arrange
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const probe = (): Promise<unknown> => new Promise(() => undefined);
    // Act
    const check = await pingRedis(probe, 20);
    // Assert
    expect(check).toMatchObject({ ok: false, reason: CACHE_UNREACHABLE_REASON });
  });

  it('reports a probe that answers as ok, without a reason', async () => {
    // Act
    const check = await pingRedis(() => Promise.resolve('PONG'));
    // Assert
    expect(check.ok).toBe(true);
    expect(check).not.toHaveProperty('reason');
  });
});
