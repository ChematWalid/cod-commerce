import { toPostgresFields } from '@cod/shared';
import { Client } from 'pg';
import { loadEnv } from '../../../src/config/env';

/** The maintenance database every Postgres server has; databases are created and dropped from it. */
const MAINTENANCE_DATABASE = 'postgres';

/** A test database name is interpolated into DDL, so it is limited to a safe identifier. */
const TEST_DATABASE_NAME = /^[a-z][a-z0-9_]*$/;

function directUrl(): URL {
  return new URL(loadEnv().DATABASE_URL_DIRECT);
}

function urlFor(database: string): string {
  const url = directUrl();
  url.pathname = `/${database}`;
  return url.toString();
}

function assertSafeName(name: string): void {
  if (!TEST_DATABASE_NAME.test(name)) {
    throw new Error(`Unsafe test database name: ${name}`);
  }
}

/** A connected `pg` client for a Postgres URL; the caller ends it. */
export async function connectTo(url: string): Promise<Client> {
  const { username, ...fields } = toPostgresFields(url);
  const client = new Client({ ...fields, user: username });
  await client.connect();
  return client;
}

/** Runs one statement on the maintenance database, straight to Postgres (never through PgBouncer). */
async function onMaintenanceDatabase(sql: string): Promise<void> {
  const client = await connectTo(urlFor(MAINTENANCE_DATABASE));
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

/** Creates an empty database (dropping a leftover of the same name) and returns its direct URL. */
export async function createDatabase(name: string): Promise<string> {
  assertSafeName(name);
  await onMaintenanceDatabase(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await onMaintenanceDatabase(`CREATE DATABASE "${name}"`);
  return urlFor(name);
}

/** Drops a database created by {@link createDatabase}, closing any connection still open on it. */
export async function dropDatabase(name: string): Promise<void> {
  assertSafeName(name);
  await onMaintenanceDatabase(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
}
