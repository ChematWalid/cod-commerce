import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIG_ERROR_EXIT_CODE, CONFIG_INVALID_EVENT, failFastOnInvalidEnv } from '../../src/boot/fail-fast-env';

/** Stands in for process.exit, which must not end the test run. */
class ExitCalled extends Error {}

const complete = {
  APP_ENV: 'production',
  NEXT_DEPLOYMENT_ID: 'abc1234',
  REDIS_URL: 'redis://v:6379',
  INTERNAL_API_URL: 'http://api:3000',
};

/** Runs the boot check with exit and the log intercepted, and returns the one line it logged. */
function fatalLineOf(env: NodeJS.Dict<string>): Record<string, unknown> {
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new ExitCalled();
  });
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  expect(() => {
    failFastOnInvalidEnv(env);
  }).toThrow(ExitCalled);
  expect(exit).toHaveBeenCalledWith(CONFIG_ERROR_EXIT_CODE);
  expect(log).toHaveBeenCalledTimes(1);
  return JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
}

describe('fail fast on an invalid environment', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs one structured line and exits non-zero when REDIS_URL is missing in production', () => {
    // Arrange
    const env = { ...complete, REDIS_URL: undefined };
    // Act
    const line = fatalLineOf(env);
    // Assert
    expect(line).toMatchObject({ level: 'fatal', event: CONFIG_INVALID_EVENT });
    expect(String(line['error'])).toContain('REDIS_URL is required');
  });

  it('exits when INTERNAL_API_URL is missing, instead of answering 500 to every page (audit SF-1)', () => {
    // Arrange
    const env = { ...complete, INTERNAL_API_URL: undefined };
    // Act
    const line = fatalLineOf(env);
    // Assert
    expect(line['issues']).toEqual(['INTERNAL_API_URL is required']);
  });

  it('exits when INTERNAL_API_URL is malformed', () => {
    // Arrange
    const env = { ...complete, INTERNAL_API_URL: 'api:3000' };
    // Act
    const line = fatalLineOf(env);
    // Assert
    expect(line['issues']).toEqual(['INTERNAL_API_URL must be an http:// or https:// URL']);
  });

  it('returns quietly with a complete config', () => {
    // Arrange
    const exit = vi.spyOn(process, 'exit');
    // Act
    failFastOnInvalidEnv(complete);
    // Assert
    expect(exit).not.toHaveBeenCalled();
  });
});
