import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEV_REDIS_URL } from '../../cache/constants';
import { CONFIG_ERROR_EXIT_CODE, CONFIG_INVALID_EVENT } from '../../src/boot/fail-fast-env';
import { waitForHttp } from '../support/http-get-with-host';

/** The standalone server `next build` writes (what the image runs). */
const STANDALONE_SERVER = join(__dirname, '../../.next/standalone/apps/storefront/server.js');
/** Ports apart from the `next start` under test on 3001 (and the api on 3100). */
const FAILING_PORT = 3091;
const BOOTING_PORT = 3092;
/** A misconfigured server must be gone well within this. */
const EXIT_TIMEOUT_MS = 10_000;
const BOOT_TIMEOUT_MS = 30_000;

let server: ChildProcess | null = null;

/** Where the booting server would find the API; boot only checks that it is a URL. */
const INTERNAL_API_URL = 'http://127.0.0.1:3100';

/** The two variables a test can leave out; undefined starts the server without that one. */
interface BootEnv {
  readonly redisUrl: string | undefined;
  readonly internalApiUrl: string | undefined;
}

/** Starts the standalone server as production with the given variables. */
function startStandalone(port: number, boot: BootEnv): ChildProcess {
  const env: NodeJS.ProcessEnv = { ...process.env, APP_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1' };
  // Empty rather than unset: Next loads a local apps/storefront/.env (copied into the standalone output) for
  // every variable the environment leaves undefined, and an empty value counts as missing.
  env['REDIS_URL'] = boot.redisUrl ?? '';
  env['INTERNAL_API_URL'] = boot.internalApiUrl ?? '';
  // The standalone server embeds the build's deployment id and overrides this one; it only has to be set.
  env['NEXT_DEPLOYMENT_ID'] ??= 'boot-check';
  return spawn(process.execPath, [STANDALONE_SERVER], { env, stdio: ['ignore', 'ignore', 'pipe'] });
}

/** Resolves with the exit code, or null when the process is still running after `timeoutMs`. */
function exitCodeWithin(child: ChildProcess, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(null);
    }, timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

describe('storefront boot configuration (standalone server)', () => {
  afterEach(() => {
    if (server?.exitCode === null) server.kill('SIGTERM');
    server = null;
  });

  it('the standalone build is present (run next build first)', () => {
    expect(existsSync(STANDALONE_SERVER)).toBe(true);
  });

  it('exits non-zero at boot when REDIS_URL is missing in production', async () => {
    // Arrange
    server = startStandalone(FAILING_PORT, { redisUrl: undefined, internalApiUrl: INTERNAL_API_URL });
    let stderr = '';
    server.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    // Act
    const code = await exitCodeWithin(server, EXIT_TIMEOUT_MS);
    // Assert
    expect(code).toBe(CONFIG_ERROR_EXIT_CODE);
    expect(stderr).toContain(`"event":"${CONFIG_INVALID_EVENT}"`);
    expect(stderr).toContain('REDIS_URL is required');
  });

  it('exits non-zero at boot when INTERNAL_API_URL is missing (audit SF-1)', async () => {
    // Arrange
    const redisUrl = process.env['REDIS_URL'] ?? DEV_REDIS_URL;
    server = startStandalone(FAILING_PORT, { redisUrl, internalApiUrl: undefined });
    let stderr = '';
    server.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString('utf8')));
    // Act
    const code = await exitCodeWithin(server, EXIT_TIMEOUT_MS);
    // Assert
    expect(code).toBe(CONFIG_ERROR_EXIT_CODE);
    expect(stderr).toContain(`"event":"${CONFIG_INVALID_EVENT}"`);
    expect(stderr).toContain('INTERNAL_API_URL is required');
  });

  it('boots and answers /livez when REDIS_URL and INTERNAL_API_URL are set', async () => {
    // Arrange
    const redisUrl = process.env['REDIS_URL'] ?? DEV_REDIS_URL;
    server = startStandalone(BOOTING_PORT, { redisUrl, internalApiUrl: INTERNAL_API_URL });
    // Act + Assert: waitForHttp throws when /livez never answers 200.
    await waitForHttp(`http://127.0.0.1:${String(BOOTING_PORT)}/livez`, 200, BOOT_TIMEOUT_MS);
    expect(server.exitCode).toBeNull();
  });
});
