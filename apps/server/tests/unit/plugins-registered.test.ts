import { TemplatePlugin } from '@cod/plugin-template';
import { describe, expect, it } from 'vitest';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';

const valid = {
  APP_ENV: 'test',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  SUPERADMIN_USERNAME: 'superadmin',
  SUPERADMIN_PASSWORD: 'test-password',
  S3_ENDPOINT: 'http://garage:3900',
  S3_ACCESS_KEY: 'GK' + 'a'.repeat(24),
  S3_SECRET_KEY: 'b'.repeat(64),
  S3_BUCKET_PRIVATE: 'cod-private',
};

describe('buildPlugins', () => {
  // A plugin with entities must be in every role, or `migrate` would not create its tables (B1).
  it.each(SERVER_ROLES)('registers TemplatePlugin for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(TemplatePlugin);
  });
});
