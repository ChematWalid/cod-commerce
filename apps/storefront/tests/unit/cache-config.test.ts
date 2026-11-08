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
});
