import { join } from 'node:path';
import { toPostgresFields } from '@cod/shared';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { AppEnv, ServerRole } from './env';

/** How long a role waits for a pooled connection before the query fails. */
export const DB_CONNECTION_TIMEOUT_MS = 5000;

/** Compiled and source migrations alike; the folder may not exist before the first migration. */
const MIGRATIONS_GLOB = join(__dirname, '../migrations/*.+(js|ts)');

/**
 * The TypeORM connection of a role. `migrate` connects to Postgres directly (DDL is not run through
 * PgBouncer's transaction pooling; the migrate advisory lock lives on a separate direct connection, see
 * `migrate.role.ts`); the api and worker go through the pooler.
 */
export function buildDbConfig(env: AppEnv, role: ServerRole): PostgresConnectionOptions {
  const url = role === 'migrate' ? env.DATABASE_URL_DIRECT : env.DATABASE_URL;
  return {
    type: 'postgres',
    ...toPostgresFields(url),
    synchronize: false,
    migrations: [MIGRATIONS_GLOB],
    applicationName: `cod-${role}`,
    extra: { max: env.DB_POOL_MAX, connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS },
  };
}
