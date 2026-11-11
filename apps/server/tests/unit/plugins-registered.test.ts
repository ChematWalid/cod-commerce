import { AuthPlugin, RandomAssetNamingStrategy } from '@cod/plugin-auth';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { RbacPlugin } from '@cod/plugin-rbac';
import { TemplatePlugin } from '@cod/plugin-template';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { type AssetServerOptions, AssetServerPlugin, type ImageTransformStrategy } from '@vendure/asset-server-plugin';
import { describe, expect, it } from 'vitest';
import { authEmailTemplates } from '../../src/email';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';

const valid = {
  APP_ENV: 'test',
  TZ: 'UTC',
  DATABASE_URL: 'postgresql://cod:pw@pgbouncer:5432/cod',
  DATABASE_URL_DIRECT: 'postgresql://cod:pw@postgres:5432/cod',
  REDIS_URL: 'redis://valkey:6379',
  COOKIE_SECRET: 'x'.repeat(32),
  AUTH_TOKEN_SECRET: 'y'.repeat(32),
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

  it.each(SERVER_ROLES)(
    'registers AuthPlugin with the token secret and mail settings for the %s role',
    (role: ServerRole) => {
      // Arrange
      const env = loadEnv({ ...valid, ROLE: role });

      // Act
      const plugins = buildPlugins(env, role);

      // Assert
      expect(plugins).toContain(AuthPlugin);
      expect(AuthPlugin.options).toEqual({
        tokenSecret: 'y'.repeat(32),
        dashboardUrl: 'http://localhost:3100/dashboard',
        platformDomain: env.PLATFORM_DOMAIN,
        email: {
          smtp: { host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.SMTP_FROM, tls: 'none' },
          templates: authEmailTemplates,
        },
      });
    },
  );

  it('hands the SMTP relay account and the TLS mode to AuthPlugin', () => {
    // Arrange
    const env = loadEnv({
      ...valid,
      ROLE: 'worker',
      SMTP_HOST: 'smtp.example.test',
      SMTP_PORT: '587',
      SMTP_FROM: 'user@example.test',
      SMTP_TLS: 'starttls',
      SMTP_USERNAME: 'user@example.test',
      SMTP_PASSWORD: 'not-a-real-password',
    });

    // Act
    buildPlugins(env, 'worker');

    // Assert
    expect(AuthPlugin.options?.email.smtp).toEqual({
      host: 'smtp.example.test',
      port: 587,
      from: 'user@example.test',
      tls: 'starttls',
      auth: { user: 'user@example.test', pass: 'not-a-real-password' },
    });
  });

  it.each(SERVER_ROLES)('registers TenancyPlugin for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(TenancyPlugin);
  });

  it.each(SERVER_ROLES)('registers PlatformJobsPlugin with the pooled queues for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(PlatformJobsPlugin);
    expect(PlatformJobsPlugin.options).toMatchObject({
      redisUrl: 'redis://valkey:6379',
      appEnv: 'test',
      pooledQueues: { connection: { host: 'valkey', port: 6379, maxRetriesPerRequest: null } },
    });
  });

  it.each(SERVER_ROLES)('registers RbacPlugin for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(RbacPlugin);
  });

  it.each(SERVER_ROLES)(
    'registers RateLimitPlugin with the client address header for the %s role',
    (role: ServerRole) => {
      // Arrange
      const env = loadEnv({ ...valid, ROLE: role, CLIENT_IP_HEADER: 'cf-connecting-ip' });

      // Act
      buildPlugins(env, role);

      // Assert: tenancy, registered after it, must not have replaced the options with its default
      expect(buildPlugins(env, role)).toContain(RateLimitPlugin);
      expect(RateLimitPlugin.options).toEqual({ redisUrl: 'redis://valkey:6379', clientIpHeader: 'cf-connecting-ip' });
    },
  );

  it.each(SERVER_ROLES)('registers the asset server on the Garage bucket for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(AssetServerPlugin);
    const { options } = AssetServerPlugin as unknown as { options: AssetServerOptions };
    expect(options.route).toBe('assets');
    expect(options.storageStrategyFactory).toBeTypeOf('function');
    expect(options.namingStrategy).toBeInstanceOf(RandomAssetNamingStrategy);
  });

  it('lets an anonymous asset request pick a preset only, never its own size', async () => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: 'api' });
    buildPlugins(env, 'api');
    const { options } = AssetServerPlugin as unknown as { options: AssetServerOptions };
    const strategy = options.imageTransformStrategy as ImageTransformStrategy;
    const medium = { name: 'medium', width: 500, height: 500, mode: 'resize' } as const;
    const input = {
      width: 37,
      height: 11,
      mode: 'crop',
      quality: undefined,
      format: undefined,
      fpx: 0.1,
      fpy: 0.2,
      preset: undefined,
      backgroundColor: undefined,
    } as const;

    // Act
    const parameters = await strategy.getImageTransformParameters({
      req: {} as never,
      input,
      availablePresets: [medium],
    });

    // Assert
    expect(parameters).toMatchObject({ width: 500, height: 500, mode: 'resize', fpx: undefined, fpy: undefined });
  });
});
