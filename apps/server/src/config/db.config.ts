import { join } from 'node:path';
import { toPostgresFields } from '@cod/shared';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { MIGRATE_LOCK_TIMEOUT_MS, MIGRATE_STATEMENT_TIMEOUT_MS } from '../roles/migrate.constants';
import type { AppEnv, ServerRole } from './env';

/** How long a role waits for a pooled connection before the query fails. */
export const DB_CONNECTION_TIMEOUT_MS = 5000;

/**
 * What the `migrate` role logs: errors, schema sync output and one line per applied migration. Not `query`,
 * which Vendure's migrate defaults to: it prints every statement and the parameters of data migrations.
 */
export const MIGRATE_DB_LOGGING: PostgresConnectionOptions['logging'] = ['error', 'schema', 'migration'];

/** Compiled and source migrations alike; the folder may not exist before the first migration. */
const MIGRATIONS_GLOB = join(__dirname, '../migrations/*.+(js|ts)');

/** The server-side timeouts of the migrations' connection; tests pass shorter ones. */
export interface MigrateTimeouts {
  readonly lockTimeoutMs: number;
  readonly statementTimeoutMs: number;
}

const DEFAULT_MIGRATE_TIMEOUTS: MigrateTimeouts = {
  lockTimeoutMs: MIGRATE_LOCK_TIMEOUT_MS,
  statementTimeoutMs: MIGRATE_STATEMENT_TIMEOUT_MS,
};

/**
 * The TypeORM connection of a role. `migrate` connects to Postgres directly (DDL is not run through
 * PgBouncer's transaction pooling; the migrate advisory lock lives on a separate direct connection, see
 * `migrate.role.ts`) and logs without queries; the api and worker go through the pooler. The migrate
 * connection also carries `lock_timeout` and `statement_timeout` (D122): `pg` sends them in the startup message.
 */
export function buildDbConfig(
  env: AppEnv,
  role: ServerRole,
  timeouts: MigrateTimeouts = DEFAULT_MIGRATE_TIMEOUTS,
): PostgresConnectionOptions {
  const url = role === 'migrate' ? env.DATABASE_URL_DIRECT : env.DATABASE_URL;
  return {
    type: 'postgres',
    ...toPostgresFields(url),
    synchronize: false,
    migrations: [MIGRATIONS_GLOB],
    applicationName: `cod-${role}`,
    ...(role === 'migrate' ? { logging: MIGRATE_DB_LOGGING } : {}),
    extra: {
      max: env.DB_POOL_MAX,
      connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
      ...(role === 'migrate'
        ? { lock_timeout: timeouts.lockTimeoutMs, statement_timeout: timeouts.statementTimeoutMs }
        : {}),
    },
  };
}
