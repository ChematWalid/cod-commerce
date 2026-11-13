import { AuthPlugin, RandomAssetNamingStrategy } from '@cod/plugin-auth';
import { PlatformFlagsPlugin } from '@cod/plugin-platform-flags';
import { PlatformJobsPlugin } from '@cod/plugin-platform-jobs';
import { PlatformOutboxPlugin } from '@cod/plugin-platform-outbox';
import { PlatformPartitionsPlugin } from '@cod/plugin-platform-partitions';
import { PlatformSecretsPlugin } from '@cod/plugin-platform-secrets';
import { RateLimitPlugin } from '@cod/plugin-rate-limit';
import { RbacPlugin } from '@cod/plugin-rbac';
import { TeamPlugin } from '@cod/plugin-team';
import { TemplatePlugin } from '@cod/plugin-template';
import { TenancyPlugin } from '@cod/plugin-tenancy';
import { type AssetServerOptions, AssetServerPlugin, type ImageTransformStrategy } from '@vendure/asset-server-plugin';
import { describe, expect, it } from 'vitest';
import { authEmailTemplates } from '../../src/email';
import { loadEnv, SERVER_ROLES, type ServerRole } from '../../src/config/env';
import { buildPlugins } from '../../src/config/plugins.config';
import { CORE_ENV, STRONG_SECRETS, syntheticSecret } from '../support/deployed-env.fixture';

const valid = CORE_ENV;
const SMTP_PASSWORD = syntheticSecret('smtp-password', 19);

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

  // The migrate role runs the first maintenance, and every role needs the registry that owning plugins fill.
  it.each(SERVER_ROLES)('registers PlatformPartitionsPlugin for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(PlatformPartitionsPlugin);
  });

  // The outbox declares entities, so every role registers it (the migrate role creates its tables).
  it.each(SERVER_ROLES)('registers PlatformOutboxPlugin for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(PlatformOutboxPlugin);
  });

  // The flags declare entities, so every role registers them; they read Valkey through `REDIS_URL` and key it by `APP_ENV`.
  it.each(SERVER_ROLES)(
    'registers PlatformFlagsPlugin with the Valkey address and environment for the %s role',
    (role: ServerRole) => {
      // Arrange
      const env = loadEnv({ ...valid, ROLE: role });

      // Act
      const plugins = buildPlugins(env, role);

      // Assert
      expect(plugins).toContain(PlatformFlagsPlugin);
      expect(PlatformFlagsPlugin.options).toEqual({ redisUrl: 'redis://valkey:6379', appEnv: 'test' });
    },
  );

  // The secrets declare entities, so every role registers them (the migrate role creates their tables).
  it.each(SERVER_ROLES)('registers PlatformSecretsPlugin with the key ring for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(PlatformSecretsPlugin);
    expect(PlatformSecretsPlugin.options?.kekRing.activeKid).toBe('k1');
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
        tokenSecret: STRONG_SECRETS.AUTH_TOKEN_SECRET,
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
      SMTP_PASSWORD,
    });

    // Act
    buildPlugins(env, 'worker');

    // Assert
    expect(AuthPlugin.options?.email.smtp).toEqual({
      host: 'smtp.example.test',
      port: 587,
      from: 'user@example.test',
      tls: 'starttls',
      auth: { user: 'user@example.test', pass: SMTP_PASSWORD },
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

  it.each(SERVER_ROLES)('registers TeamPlugin with the dashboard URL for the %s role', (role: ServerRole) => {
    // Arrange
    const env = loadEnv({ ...valid, ROLE: role });

    // Act
    const plugins = buildPlugins(env, role);

    // Assert
    expect(plugins).toContain(TeamPlugin);
    expect(TeamPlugin.options).toEqual({ dashboardUrl: env.AUTH_DASHBOARD_URL });
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
