import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_ERROR_EXIT_CODE,
  CONFIG_INVALID_EVENT,
  failFastOnInvalidCacheConfig,
} from '../../src/boot/fail-fast-cache-config';

/** Stands in for process.exit, which must not end the test run. */
class ExitCalled extends Error {}

describe('fail fast on an invalid cache config', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs one structured line and exits non-zero when REDIS_URL is missing in production', () => {
    // Arrange
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new ExitCalled();
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Act
    const run = (): void => {
      failFastOnInvalidCacheConfig({ APP_ENV: 'production', NEXT_DEPLOYMENT_ID: 'abc1234' });
    };
    // Assert
    expect(run).toThrow(ExitCalled);
    expect(exit).toHaveBeenCalledWith(CONFIG_ERROR_EXIT_CODE);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(log.mock.calls[0]?.[0]))).toMatchObject({ level: 'fatal', event: CONFIG_INVALID_EVENT });
  });

  it('returns quietly with a complete config', () => {
    // Arrange
    const exit = vi.spyOn(process, 'exit');
    // Act
    failFastOnInvalidCacheConfig({ APP_ENV: 'production', NEXT_DEPLOYMENT_ID: 'abc1234', REDIS_URL: 'redis://v:6379' });
    // Assert
    expect(exit).not.toHaveBeenCalled();
  });
});
