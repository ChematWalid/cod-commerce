import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { describe, expect, it } from 'vitest';
import { CacheConfigError, readCacheConfig } from '../../cache/cache-config';

describe('cache config', () => {
  it('refuses a missing NEXT_DEPLOYMENT_ID outside development', () => {
    // Arrange
    const env = { APP_ENV: 'production', REDIS_URL: 'redis://valkey:6379' };
    // Act
    const read = (): unknown => readCacheConfig(env);
    // Assert
    expect(read).toThrow(CacheConfigError);
  });

  it('defaults the deployment id to dev in development', () => {
    expect(readCacheConfig({ APP_ENV: 'development' }).deploymentId).toBe('dev');
  });

  it('refuses a missing REDIS_URL outside development', () => {
    // Arrange
    const env = { APP_ENV: 'production', NEXT_DEPLOYMENT_ID: 'abc1234' };
    // Act
    const read = (): unknown => readCacheConfig(env);
    // Assert
    expect(read).toThrow(CacheConfigError);
  });

  it('accepts a missing REDIS_URL during next build, which opens no connection', () => {
    // Arrange
    const env = { APP_ENV: 'production', NEXT_DEPLOYMENT_ID: 'abc1234', NEXT_PHASE: PHASE_PRODUCTION_BUILD };
    // Act
    const config = readCacheConfig(env);
    // Assert
    expect(config.deploymentId).toBe('abc1234');
  });

  it('defaults REDIS_URL to the host-run Valkey in development', () => {
    expect(readCacheConfig({ APP_ENV: 'development' }).redisUrl).toBe('redis://localhost:6380');
  });
});
