import { PROBE_TIMEOUT_MS } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';

/** What the probe needs from a database client, such as TypeORM's `DataSource` or a `pg` pool. */
export interface SqlQueryRunner {
  query(sql: string): Promise<unknown>;
}

/** Ready when Postgres answers a trivial query through the app's own connection pool. */
export class PostgresProbe implements ReadinessProbe {
  readonly name = 'postgres';
  readonly timeoutMs = PROBE_TIMEOUT_MS.postgres;

  constructor(private readonly database: SqlQueryRunner) {}

  async check(): Promise<void> {
    await this.database.query('SELECT 1');
  }
}
