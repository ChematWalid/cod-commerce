import { get } from 'node:http';
import { DEFAULT_API_PORT, DEFAULT_WORKER_HEALTH_PORT } from './config/ports';

/**
 * The container healthcheck (`node dist/healthcheck.js`, every 10 s with a 3 s timeout). It must start fast,
 * so it imports neither Vendure nor the env schema: it reads only `ROLE` and the role's port.
 */

/** `PlatformHealthPlugin`'s readiness path, on the api port and on the worker health port alike. */
export const READYZ_PATH = '/readyz';

/** Below the container's 3 s healthcheck timeout, above the slowest readiness probe (2 s). */
export const HEALTHCHECK_TIMEOUT_MS = 2500;

const HTTP_OK = 200;
const LOOPBACK = '127.0.0.1';
const MAX_PORT = 65535;

/** The role has no health endpoint (`migrate`), or its port variable is not a port. */
export class HealthcheckConfigError extends Error {
  constructor(reason: string) {
    super(`Healthcheck: ${reason}`);
    this.name = 'HealthcheckConfigError';
  }
}

function portOf(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new HealthcheckConfigError(`${name} is not a port`);
  }
  return port;
}

/** The `/readyz` URL of the process started with `source`'s `ROLE`. */
export function healthcheckUrl(source: NodeJS.ProcessEnv): string {
  const role = source['ROLE'];
  if (role === 'api') {
    return `http://${LOOPBACK}:${String(portOf(source['API_PORT'], DEFAULT_API_PORT, 'API_PORT'))}${READYZ_PATH}`;
  }
  if (role === 'worker') {
    const port = portOf(source['WORKER_HEALTH_PORT'], DEFAULT_WORKER_HEALTH_PORT, 'WORKER_HEALTH_PORT');
    return `http://${LOOPBACK}:${String(port)}${READYZ_PATH}`;
  }
  throw new HealthcheckConfigError(`ROLE=${String(role)} has no health endpoint`);
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
