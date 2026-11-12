import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';
import { HealthcheckConfigError, readHealthEnv } from '../../src/config/health-env';
import { CORE_ENV } from '../support/deployed-env.fixture';

/** ROLE is left unset: each case's source decides it, as it does for the healthcheck. */
const valid = { ...CORE_ENV, ROLE: undefined };

type Source = Record<string, string>;

/** What the full schema makes of the three variables the healthcheck reads, or `'rejected'`. */
function schemaView(source: Source): unknown {
  try {
    const env = loadEnv({ ...valid, ...source });
    return { role: env.ROLE, apiPort: env.API_PORT, workerHealthPort: env.WORKER_HEALTH_PORT };
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return 'rejected';
    }
    throw error;
  }
}

function healthView(source: Source): unknown {
  try {
    return readHealthEnv(source);
  } catch (error) {
    if (error instanceof HealthcheckConfigError) {
      return 'rejected';
    }
    throw error;
  }
}

describe('readHealthEnv', () => {
  it('reads the role and both ports, with the defaults of the schema', () => {
    expect(readHealthEnv({ ROLE: 'api' })).toEqual({ role: 'api', apiPort: 3000, workerHealthPort: 3020 });
    expect(readHealthEnv({ ROLE: 'worker', API_PORT: '3100', WORKER_HEALTH_PORT: '3021' })).toEqual({
      role: 'worker',
      apiPort: 3100,
      workerHealthPort: 3021,
    });
  });

  it('names the variable it refuses, never its value', () => {
    expect(() => readHealthEnv({ ROLE: 'api', WORKER_HEALTH_PORT: 'secret-looking-value' })).toThrow(
      'Healthcheck: WORKER_HEALTH_PORT is not a port',
    );
    expect(() => readHealthEnv({ ROLE: 'storefront' })).toThrow('Healthcheck: ROLE is not a server role');
  });

  it.each<[string, Source]>([
    ['the api role alone', { ROLE: 'api' }],
    ['the migrate role', { ROLE: 'migrate' }],
    ['both ports set', { ROLE: 'worker', API_PORT: '3100', WORKER_HEALTH_PORT: '3021' }],
    ['blank ports', { ROLE: 'api', API_PORT: '', WORKER_HEALTH_PORT: '' }],
    ['the highest port', { ROLE: 'api', API_PORT: '65535' }],
    ['port zero', { ROLE: 'api', API_PORT: '0' }],
    ['a port above the range', { ROLE: 'worker', WORKER_HEALTH_PORT: '65536' }],
    ['a fractional port', { ROLE: 'api', API_PORT: '3000.5' }],
    ['a port that is not a number', { ROLE: 'api', API_PORT: 'http' }],
    ['a bad port of the other role', { ROLE: 'api', WORKER_HEALTH_PORT: 'http' }],
    ['a missing role', {}],
    ['a blank role', { ROLE: '' }],
    ['a role of another image', { ROLE: 'storefront' }],
  ])('agrees with loadEnv on %s', (_name, source) => {
    expect(healthView(source)).toEqual(schemaView(source));
  });
});
