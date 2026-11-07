import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type AppEnv, loadEnv } from '../../src/config/env';
import { runMigrate } from '../../src/roles/migrate.role';
import { connectTo, createDatabase, dropDatabase } from './support/test-database';

const DATABASE_NAME = `cod_migrate_lock_${String(process.pid)}`;

describe('migrate role under concurrency', () => {
  let env: AppEnv;
  let url: string;

  beforeAll(async () => {
    url = await createDatabase(DATABASE_NAME);
    env = loadEnv({ ...process.env, DATABASE_URL: url, DATABASE_URL_DIRECT: url });
  });

  afterAll(async () => {
    await dropDatabase(DATABASE_NAME);
  });

  it('two concurrent runs on an empty database both succeed and apply Init once', async () => {
    const reports = await Promise.all([runMigrate(env), runMigrate(env)]);

    const applied = reports.map((report) => report.migrationsRun.length).sort();
    expect(applied).toEqual([0, 1]);
    const client = await connectTo(url);
    try {
      const { rows } = await client.query<{ count: string }>('SELECT count(*) AS count FROM migrations');
      expect(rows[0]?.count).toBe('1');
    } finally {
      await client.end();
    }
  });
});
