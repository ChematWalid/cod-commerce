import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from '../../src/config/env';
import { HealthcheckConfigError, readHealthEnv } from '../../src/config/health-env';

const valid = {
  APP_ENV: 'test',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  AUTH_TOKEN_SECRET: 'y'.repeat(32),
  INTERNAL_HMAC_KEYS: `k1:${'z'.repeat(40)}`,
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
};

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
