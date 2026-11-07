import { join } from 'node:path';
import { toPostgresFields } from '@cod/shared';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
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

/**
 * The TypeORM connection of a role. `migrate` connects to Postgres directly (DDL is not run through
 * PgBouncer's transaction pooling; the migrate advisory lock lives on a separate direct connection, see
 * `migrate.role.ts`) and logs without queries; the api and worker go through the pooler.
 */
export function buildDbConfig(env: AppEnv, role: ServerRole): PostgresConnectionOptions {
  const url = role === 'migrate' ? env.DATABASE_URL_DIRECT : env.DATABASE_URL;
  return {
    type: 'postgres',
    ...toPostgresFields(url),
    synchronize: false,
    migrations: [MIGRATIONS_GLOB],
    applicationName: `cod-${role}`,
    ...(role === 'migrate' ? { logging: MIGRATE_DB_LOGGING } : {}),
    extra: { max: env.DB_POOL_MAX, connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS },
  };
}
