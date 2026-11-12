import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildDbConfig } from '../../src/config/db.config';
import { type AppEnv, loadEnv } from '../../src/config/env';
import { MIGRATE_ADVISORY_LOCK_KEY } from '../../src/roles/migrate.constants';
import { MigrationLockTimeoutError, runMigrate } from '../../src/roles/migrate.role';
import { COMMITTED_MIGRATION_COUNT } from './support/committed-migrations';
import { connectTo, createDatabase, dropDatabase } from './support/test-database';

const DATABASE_NAME = `cod_migrate_timeouts_${String(process.pid)}`;
const HOLDER_NAME = 'cod-test-lock-holder';
const SHORT_MS = 500;
const LONG_MS = 60_000;

class AlterAdministrator implements MigrationInterface {
  name = 'AlterAdministratorThrowaway1700000000001';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('ALTER TABLE "administrator" ADD COLUMN "throwaway" int');
  }
  async down(): Promise<void> {}
}

class SleepPastStatementTimeout implements MigrationInterface {
  name = 'SleepPastStatementTimeoutThrowaway1700000000002';
  async up(runner: QueryRunner): Promise<void> {
    await runner.query('SELECT pg_sleep(5)');
  }
  async down(): Promise<void> {}
}

/** The SQLSTATE of the error TypeORM raised, whichever wrapper it put around the driver error. */
function sqlState(error: unknown): string | undefined {
  const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code;
  return code ?? (error as { code?: string }).code;
}

describe('migrate role waits', () => {
  let env: AppEnv;
  let url: string;

  beforeAll(async () => {
    url = await createDatabase(DATABASE_NAME);
    env = loadEnv({ ...process.env, DATABASE_URL: url, DATABASE_URL_DIRECT: url });
  });

  afterAll(async () => {
    await dropDatabase(DATABASE_NAME);
  });

  /** A TypeORM data source built from the migrate role's own connection options, with the given throwaway migration. */
  async function migrateWith(
    migration: new () => MigrationInterface,
    timeouts: { lockTimeoutMs: number; statementTimeoutMs: number },
  ): Promise<unknown> {
    const options = buildDbConfig(env, 'migrate', timeouts);
    const dataSource = new DataSource({ ...options, migrations: [migration], entities: [] });
    await dataSource.initialize();
    try {
      await dataSource.runMigrations({ transaction: 'each' });
      return undefined;
    } catch (error: unknown) {
      return error;
    } finally {
      await dataSource.destroy();
    }
  }

  it('SRV-2: a migration behind a held table lock fails with 55P03 and leaves the lock alone', async () => {
    const holder = await connectTo(url);
    try {
      await holder.query('CREATE TABLE "administrator" ("id" int)');
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE "administrator" IN ACCESS EXCLUSIVE MODE');

      const started = Date.now();
      const error = await migrateWith(AlterAdministrator, { lockTimeoutMs: SHORT_MS, statementTimeoutMs: LONG_MS });
      const elapsed = Date.now() - started;

      expect(sqlState(error)).toBe('55P03');
      expect(elapsed).toBeLessThan(SHORT_MS + 2_500);
      const { rows } = await holder.query<{ mode: string }>(
        `SELECT mode FROM pg_locks WHERE relation = '"administrator"'::regclass AND pid = pg_backend_pid()`,
      );
      expect(rows.map((row) => row.mode)).toContain('AccessExclusiveLock');
    } finally {
      await holder.query('ROLLBACK');
      await holder.query('DROP TABLE IF EXISTS "administrator"');
      await holder.end();
    }
  });

  it('SRV-2: a statement past the statement timeout fails with 57014', async () => {
    const started = Date.now();
    const error = await migrateWith(SleepPastStatementTimeout, {
      lockTimeoutMs: LONG_MS,
      statementTimeoutMs: SHORT_MS,
    });

    expect(sqlState(error)).toBe('57014');
    expect(Date.now() - started).toBeLessThan(SHORT_MS + 2_500);
  });

  it('SRV-13: a held migrate lock makes runMigrate throw a MigrationLockTimeoutError naming the holder', async () => {
    const holder = await connectTo(url);
    try {
      await holder.query('SET application_name = $1'.replace('$1', `'${HOLDER_NAME}'`));
      await holder.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATE_ADVISORY_LOCK_KEY]);

      const started = Date.now();
      const error = await runMigrate(env, { lockWaitMs: 1500 }).then(
        () => undefined,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(MigrationLockTimeoutError);
      expect((error as Error).message).toContain(HOLDER_NAME);
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      await holder.end();
    }
  });

  it('SRV-13: the run proceeds when the holder lets go inside the wait', async () => {
    const holder = await connectTo(url);
    await holder.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATE_ADVISORY_LOCK_KEY]);
    const release = setTimeout(() => {
      void holder.end();
    }, 700);
    try {
      const report = await runMigrate(env, { lockWaitMs: 5000 });
      expect(report.migrationsRun).toHaveLength(COMMITTED_MIGRATION_COUNT);
    } finally {
      clearTimeout(release);
      await holder.end().catch(() => undefined);
    }
  });
});
