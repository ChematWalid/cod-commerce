import { DefaultSessionCacheStrategy, RedisCachePlugin } from '@vendure/core';
import { testConfig } from '@vendure/testing';
import { describe, expect, it, vi } from 'vitest';
import { createPluginTestEnvironment, PLUGIN_TEST_INITIAL_DATA } from '../src/create-plugin-test-environment';
import { buildPluginTestConfig } from '../src/plugin-test-config';

const DB = { databaseUrl: 'postgresql://cod:pw@localhost:5433/cod' };
const ATTACHED_DATABASE = 'e2e_cross_process_flush_int_test_ts';

describe('buildPluginTestConfig', () => {
  it('lets the initializer build a fresh database on the default port when nothing is attached', () => {
    // Act
    const config = buildPluginTestConfig({ plugins: [], db: DB });

    // Assert
    expect(config.dbConnectionOptions).toMatchObject({ type: 'postgres', synchronize: true, database: 'cod' });
    expect(config.apiOptions.port).toBe(testConfig.apiOptions.port);
    expect(config.plugins).not.toContain(RedisCachePlugin);
  });

  it('attaches to an existing database without synchronizing or dropping it', () => {
    // Act
    const config = buildPluginTestConfig({ plugins: [], db: DB, attachToDatabase: ATTACHED_DATABASE, port: 3051 });

    // Assert
    expect(config.dbConnectionOptions).toMatchObject({
      database: ATTACHED_DATABASE,
      synchronize: false,
      dropSchema: false,
    });
    expect(config.apiOptions.port).toBe(3051);
  });

  it('keeps sessions in the named Valkey namespace when a shared cache is asked for', () => {
    // Act
    const config = buildPluginTestConfig({
      plugins: [],
      db: DB,
      sharedCache: { redisUrl: 'redis://localhost:6380/2', namespace: 'cod-test:cross-process' },
    });

    // Assert
    expect(config.plugins).toContain(RedisCachePlugin);
    expect(RedisCachePlugin.options).toMatchObject({
      namespace: 'cod-test:cross-process',
      redisOptions: { host: 'localhost', port: 6380, db: 2 },
    });
  });

  it('gives every server its own session cache strategy, so two servers in one process share no cache by accident', () => {
    // Act
    const first = buildPluginTestConfig({ plugins: [], db: DB });
    const second = buildPluginTestConfig({ plugins: [], db: DB });

    // Assert
    expect(first.authOptions.sessionCacheStrategy).toBeInstanceOf(DefaultSessionCacheStrategy);
    expect(first.authOptions.sessionCacheStrategy).not.toBe(second.authOptions.sessionCacheStrategy);
    expect(first.authOptions.sessionCacheStrategy).not.toBe(testConfig.authOptions.sessionCacheStrategy);
  });
});

describe('createPluginTestEnvironment with attachToDatabase', () => {
  it('boots without the initializer, which would drop the database the first server owns', async () => {
    // Arrange
    const { server } = createPluginTestEnvironment({ plugins: [], db: DB, attachToDatabase: ATTACHED_DATABASE });
    const bootstrap = vi.spyOn(server, 'bootstrap').mockResolvedValue(undefined);

    // Act
    await server.init({ initialData: PLUGIN_TEST_INITIAL_DATA });

    // Assert
    expect(bootstrap).toHaveBeenCalledOnce();
  });
});
