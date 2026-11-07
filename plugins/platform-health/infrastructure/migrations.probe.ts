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

/** What the probe needs from TypeORM: `DataSource.showMigrations()`, true while a migration is pending. */
export interface MigrationStatusSource {
  showMigrations(): Promise<boolean>;
}

/** Not ready until every migration has run. */
export class MigrationsProbe implements ReadinessProbe {
  readonly name = 'migrations';
  readonly timeoutMs = PROBE_TIMEOUT_MS.migrations;
  // Migrations never become pending in a running process, so the first clean answer is final.
  private applied = false;

  constructor(private readonly source: MigrationStatusSource) {}

  /** @throws {PendingMigrationsError} while a migration is pending. */
  async check(): Promise<void> {
    if (this.applied) {
      return;
    }
    if (await this.source.showMigrations()) {
      throw new PendingMigrationsError();
    }
    this.applied = true;
  }
}
