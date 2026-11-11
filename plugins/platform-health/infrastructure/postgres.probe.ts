import { PROBE_TIMEOUT_MS } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';
import { withStatementTimeout } from './statement-timeout';

/** What the probe needs from a database client, such as TypeORM's `DataSource` or a `pg` pool. */
export interface SqlQueryRunner {
  query(sql: string): Promise<unknown>;
}

/** Ready when Postgres answers a trivial query through the app's own connection pool. */
export class PostgresProbe implements ReadinessProbe {
  readonly name = 'postgres';
  readonly timeoutMs = PROBE_TIMEOUT_MS.postgres;

  constructor(private readonly database: SqlQueryRunner) {}

  /** The statement timeout makes Postgres cancel the query when the probe's budget is spent. */
  async check(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    await this.database.query(withStatementTimeout('SELECT 1', this.timeoutMs));
  }
}
