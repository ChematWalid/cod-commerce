import { DomainError } from '@cod/shared';
import { PROBE_TIMEOUT_MS } from '../domain/constants';
import type { ReadinessProbe } from '../domain/readiness';

/** The schema is behind the code: the `migrate` role has not run yet. */
export class PendingMigrationsError extends DomainError {
  readonly code = 'platform-health.pending-migrations';

  constructor() {
    super('migrations are pending');
  }
}

/** The migration class TypeORM loaded; TypeORM names it by `name`, else by its class name. */
interface LoadedMigration {
  readonly name?: string;
}

/**
 * What the probe needs from a TypeORM `DataSource`. `query()` releases its connection whatever happens, and
 * the probe only reads, so it never runs DDL through the pooler.
 */
export interface MigrationsDataSource {
  readonly options: { readonly migrationsTableName?: string };
  readonly migrations: readonly LoadedMigration[];
  query(sql: string): Promise<unknown>;
}

/** TypeORM's default name for the table of executed migrations. */
const DEFAULT_MIGRATIONS_TABLE = 'migrations';

/** Postgres' SQLSTATE for "relation does not exist": no migration has ever run. */
const UNDEFINED_TABLE = '42P01';

const quoteIdentifier = (identifier: string): string => `"${identifier.replaceAll('"', '""')}"`;

const nameOf = (migration: LoadedMigration): string => migration.name ?? migration.constructor.name;

/** TypeORM's `QueryFailedError` copies the driver error's fields, so the SQLSTATE is on `code`. */
const isUndefinedTable = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === UNDEFINED_TABLE;

const executedNamesOf = (rows: unknown): Set<string> => {
  const names = Array.isArray(rows) ? rows.map((row: { name?: unknown }) => row.name) : [];
  return new Set(names.filter((name): name is string => typeof name === 'string'));
};

/** Not ready until every migration the code knows has run. */
export class MigrationsProbe implements ReadinessProbe {
  readonly name = 'migrations';
  readonly timeoutMs = PROBE_TIMEOUT_MS.migrations;
  // Migrations never become pending in a running process, so the first clean answer is final.
  private applied = false;

  constructor(private readonly source: MigrationsDataSource) {}

  /**
   * @throws {PendingMigrationsError} while a migration is pending or the migrations table does not exist.
   * Any other query error propagates, so `/readyz` reports it.
   */
  async check(signal?: AbortSignal): Promise<void> {
    if (this.applied) {
      return;
    }
    signal?.throwIfAborted();
    const executed = await this.executedMigrations();
    if (this.source.migrations.some((migration) => !executed.has(nameOf(migration)))) {
      throw new PendingMigrationsError();
    }
    this.applied = true;
  }

  private async executedMigrations(): Promise<Set<string>> {
    const table = quoteIdentifier(this.source.options.migrationsTableName ?? DEFAULT_MIGRATIONS_TABLE);
    try {
      return executedNamesOf(await this.source.query(`SELECT "name" FROM ${table}`));
    } catch (error) {
      if (isUndefinedTable(error)) {
        throw new PendingMigrationsError();
      }
      throw error;
    }
  }
}
