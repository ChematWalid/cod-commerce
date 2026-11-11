import { get } from 'node:http';
import { HealthcheckConfigError, readHealthEnv } from './config/health-env';

/**
 * The container healthcheck (`node dist/healthcheck.js`, every 10 s with a 3 s timeout). It must start fast,
 * so it imports neither Vendure nor the env schema: `readHealthEnv` reads `ROLE` and the two ports under the
 * schema's rules.
 */

export { HealthcheckConfigError };

/** `PlatformHealthPlugin`'s readiness path, on the api port and on the worker health port alike. */
export const READYZ_PATH = '/readyz';

/** Below the container's 3 s healthcheck timeout, above the slowest readiness probe (2 s). */
export const HEALTHCHECK_TIMEOUT_MS = 2500;

const HTTP_OK = 200;
const LOOPBACK = '127.0.0.1';

/** The `/readyz` URL of the process started with `source`'s `ROLE`. */
export function healthcheckUrl(source: NodeJS.ProcessEnv): string {
  const env = readHealthEnv(source);
  if (env.role === 'migrate') {
    throw new HealthcheckConfigError('ROLE=migrate has no health endpoint');
  }
  const port = env.role === 'api' ? env.apiPort : env.workerHealthPort;
  return `http://${LOOPBACK}:${String(port)}${READYZ_PATH}`;
}

/** True when `url` answers 200 within `timeoutMs`; any other status, error or timeout is false. */
export function isReady(url: string, timeoutMs: number = HEALTHCHECK_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const request = get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      resolve(response.statusCode === HTTP_OK);
    });
    request.on('timeout', () => request.destroy(new Error(`no answer within ${String(timeoutMs)} ms`)));
    request.on('error', (error) => {
      process.stderr.write(`healthcheck: ${error.message}\n`);
      resolve(false);
    });
  });
}

async function main(): Promise<number> {
  return (await isReady(healthcheckUrl(process.env))) ? 0 : 1;
}

if (require.main === module) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}
