/** Where a plugin's integration tests create their databases. */
export interface PluginTestDbConfig {
  /** A direct Postgres URL (never through PgBouncer): the test server creates one database per test file there. */
  readonly databaseUrl: string;
}

/** The variable that holds the direct Postgres URL, as in `apps/server/.env` and the CI `integration` job. */
const DATABASE_URL_VARIABLE = 'DATABASE_URL_DIRECT';

/** Thrown when the integration tests have no database to run against. */
export class MissingTestDatabaseUrlError extends Error {
  constructor() {
    super(
      `${DATABASE_URL_VARIABLE} is not set: copy apps/server/.env.example to apps/server/.env, ` +
        'or pass it through turbo (test:integration.passThroughEnv)',
    );
    this.name = 'MissingTestDatabaseUrlError';
  }
}

/**
 * Reads the test database of a plugin's integration tests from `env`.
 *
 * @throws {MissingTestDatabaseUrlError} when `DATABASE_URL_DIRECT` is unset or empty.
 */
export function loadPluginTestDbConfig(env: NodeJS.ProcessEnv): PluginTestDbConfig {
  const databaseUrl = env[DATABASE_URL_VARIABLE];
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new MissingTestDatabaseUrlError();
  }
  return { databaseUrl };
}
