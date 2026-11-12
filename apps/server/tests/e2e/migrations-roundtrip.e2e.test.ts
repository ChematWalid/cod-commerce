import { preBootstrapConfig, resetConfig } from '@vendure/core';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppEnv, loadEnv } from '../../src/config/env';
import { buildVendureConfig } from '../../src/config/vendure-config';
import { MIGRATE_LOCK_TIMEOUT_MS, MIGRATE_STATEMENT_TIMEOUT_MS } from '../../src/roles/migrate.constants';
import { runMigrate } from '../../src/roles/migrate.role';
import { COMMITTED_MIGRATION_COUNT } from './support/committed-migrations';
import { catalogSnapshot } from './support/schema-catalog';
import { connectTo, createDatabase, dropDatabase } from './support/test-database';

const DATABASE_NAME = `cod_roundtrip_${String(process.pid)}`;

/** The snapshot of the whole `public` schema of the scratch database. */
async function snapshotOf(url: string): Promise<Record<string, unknown[]>> {
  const client = await connectTo(url);
  try {
    return await catalogSnapshot(client);
  } finally {
    await client.end();
  }
}

/** Reverts every migration newest first, the way the migrate role's connection would (D122 timeouts). */
async function revertAll(env: AppEnv): Promise<{ reverted: number; lockTimeout: string; statementTimeout: string }> {
  const config = await preBootstrapConfig(buildVendureConfig(env, 'migrate'));
  const dataSource = await new DataSource({ ...config.dbConnectionOptions, synchronize: false }).initialize();
  try {
    const [lock] = await dataSource.query<{ lock_timeout: string }[]>('SHOW lock_timeout');
    const [statement] = await dataSource.query<{ statement_timeout: string }[]>('SHOW statement_timeout');
    let reverted = 0;
    for (;;) {
      const remaining = await dataSource.query<{ n: number }[]>('SELECT count(*)::int AS n FROM migrations');
      if (remaining[0]?.n === 0) break;
      await dataSource.undoLastMigration({ transaction: 'each' });
      reverted += 1;
    }
    return {
      reverted,
      lockTimeout: lock?.lock_timeout ?? '',
      statementTimeout: statement?.statement_timeout ?? '',
    };
  } finally {
    await dataSource.destroy();
    resetConfig();
  }
}

// Audit SRV-7: a migration whose `down` is wrong is found now, not on the night a release has to be rolled back.
describe('migrations round trip', () => {
  let env: AppEnv;
  let url: string;

  beforeAll(async () => {
    url = await createDatabase(DATABASE_NAME);
    env = loadEnv({ ...process.env, DATABASE_URL: url, DATABASE_URL_DIRECT: url });
  });

  afterAll(async () => {
    await dropDatabase(DATABASE_NAME);
  });

  it('reverts every migration and migrates up to the same schema', async () => {
    // Arrange: migrate up (with the migrate role's seed and partition maintenance), then record the schema
    const first = await runMigrate(env);
    expect(first.migrationsRun).toHaveLength(COMMITTED_MIGRATION_COUNT);
    const before = await snapshotOf(url);
    expect(before['tables']?.length).toBeGreaterThan(COMMITTED_MIGRATION_COUNT);

    // Act: down to an empty migrations table, on the migrate role's connection
    const reverted = await revertAll(env);

    // Assert: the down steps ran under the D122 timeouts and left no table of ours behind
    expect(reverted.reverted).toBe(COMMITTED_MIGRATION_COUNT);
    expect(reverted.lockTimeout).toBe(`${String(MIGRATE_LOCK_TIMEOUT_MS / 1000)}s`);
    expect(reverted.statementTimeout).toBe(`${String(MIGRATE_STATEMENT_TIMEOUT_MS / 60_000)}min`);
    const emptied = await snapshotOf(url);
    expect(emptied['tables']).toEqual([expect.objectContaining({ name: 'migrations' })]);
    expect(emptied['functions']).toEqual([]);

    // Act and assert: up again gives the schema the first run recorded
    const second = await runMigrate(env);
    expect(second.migrationsRun).toHaveLength(COMMITTED_MIGRATION_COUNT);
    expect(await snapshotOf(url)).toEqual(before);
  });
});
