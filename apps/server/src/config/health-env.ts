import { DEFAULT_API_PORT, DEFAULT_WORKER_HEALTH_PORT, isPort } from './ports';
import { SERVER_ROLES, type ServerRole } from './roles';

/**
 * The environment of the container healthcheck: `ROLE` and the two ports, nothing else.
 *
 * The healthcheck is its own short process, started every 10 s. It cannot go through `loadEnv`: that would
 * load zod and the whole schema on each probe, and would report a running server unhealthy over a variable
 * that has nothing to do with its health. So this module reads the three variables with the rules `loadEnv`
 * applies to them (the same roles, port range, defaults and blank handling, imported from the modules the
 * schema imports), and `tests/unit/health-env.test.ts` pins the two readers to each other.
 */
export interface HealthEnv {
  readonly role: ServerRole;
  readonly apiPort: number;
  readonly workerHealthPort: number;
}

/** A variable the healthcheck reads is invalid, or the role has no health endpoint. The message never holds a value. */
export class HealthcheckConfigError extends Error {
  constructor(reason: string) {
    super(`Healthcheck: ${reason}`);
    this.name = 'HealthcheckConfigError';
  }
}

const isServerRole = (value: string | undefined): value is ServerRole =>
  (SERVER_ROLES as readonly (string | undefined)[]).includes(value);

/** A blank variable counts as unset, as in `loadEnv`. */
function portOf(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const port = Number(value);
  if (!isPort(port)) {
    throw new HealthcheckConfigError(`${name} is not a port`);
  }
  return port;
}

/**
 * Reads `ROLE`, `API_PORT` and `WORKER_HEALTH_PORT` from `source`.
 *
 * @throws {HealthcheckConfigError} naming the variable `loadEnv` would refuse too.
 */
export function readHealthEnv(source: NodeJS.ProcessEnv): HealthEnv {
  const role = source['ROLE'];
  if (!isServerRole(role)) {
    throw new HealthcheckConfigError('ROLE is not a server role');
  }
  return {
    role,
    apiPort: portOf(source['API_PORT'], DEFAULT_API_PORT, 'API_PORT'),
    workerHealthPort: portOf(source['WORKER_HEALTH_PORT'], DEFAULT_WORKER_HEALTH_PORT, 'WORKER_HEALTH_PORT'),
  };
}
