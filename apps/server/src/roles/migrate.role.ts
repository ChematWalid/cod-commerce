import { setTimeout as delay } from 'node:timers/promises';
import {
  asOperationContext,
  type ConvergeReport,
  RbacConvergeFailedError,
  RbacConvergeService,
  SESSION_FLUSH_SETTLE_MS,
} from '@cod/plugin-rbac';
import { FlagSeedService } from '@cod/plugin-platform-flags';
import { PartitionMaintenanceService } from '@cod/plugin-platform-partitions';
import {
  asOperationContext as asTeamContext,
  type MemberConvergeReport,
  TeamConvergeFailedError,
  TeamConvergeService,
} from '@cod/plugin-team';
import { toPostgresFields } from '@cod/shared';
import type { INestApplicationContext } from '@nestjs/common';
import { bootstrapWorker, Logger, type MigrationDiagnostic, runMigrations } from '@vendure/core';
import { Client } from 'pg';
import { DB_CONNECTION_TIMEOUT_MS } from '../config/db.config';
import type { AppEnv } from '../config/env';
import { buildVendureConfig } from '../config/vendure-config';
import { seedPlatformDefaults, superadminContext } from '../seed/seed-platform-defaults';
import type { SeedReport } from '../seed/seed.types';
import {
  MIGRATE_ADVISORY_LOCK_KEY,
  MIGRATE_LOCK_APPLICATION_NAME,
  MIGRATE_LOCK_POLL_MS,
  MIGRATE_LOCK_WAIT_MS,
} from './migrate.constants';

const CONVERGE_LOG_CONTEXT = 'migrate';

/** The outcome of one `migrate` run. */
export interface MigrateReport {
  migrationsRun: string[];
  seed: SeedReport;
  rbacConverged: ConvergeReport;
  teamConverged: MemberConvergeReport;
}

/** Running the migrations failed, or left the schema out of step with the entities. */
export class MigrationFailedError extends Error {
  constructor(reason: string) {
    super(`Migrations failed: ${reason}`);
    this.name = 'MigrationFailedError';
  }
}

/** Read through a call: TypeScript would otherwise keep the narrowing of the last assignment across an await. */
const currentExitCode = (): typeof process.exitCode => process.exitCode;

/**
 * Vendure's `runMigrations` reports a failed migration only by setting `process.exitCode`, and drift only
 * through a diagnostic, so both are turned into an error here instead of letting the seed run on a bad schema.
 */
async function runMigrationsOrThrow(config: ReturnType<typeof buildVendureConfig>): Promise<string[]> {
  const diagnostics: MigrationDiagnostic[] = [];
  const exitCodeBefore = process.exitCode;
  // Cleared first, so a failure is seen even when an earlier error already left exitCode at 1.
  process.exitCode = undefined;
  const migrationsRun = await runMigrations(config, { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  const failed = currentExitCode() === 1;
  process.exitCode = exitCodeBefore;
  if (failed) {
    throw new MigrationFailedError('a migration threw; see the log above');
  }
  if (diagnostics.length > 0) {
    throw new MigrationFailedError(diagnostics.map((diagnostic) => diagnostic.lines.join('\n')).join('\n'));
  }
  return migrationsRun;
}

/** Another `migrate` kept the advisory lock for longer than this run was willing to wait (audit SRV-13). */
export class MigrationLockTimeoutError extends Error {
  constructor(waitedMs: number, holder: string) {
    super(`Could not take the migrate lock within ${String(waitedMs)} ms; it is held by "${holder}".`);
    this.name = 'MigrationLockTimeoutError';
  }
}

/** The `application_name` of the session holding the migrate advisory lock, for the timeout message. */
async function lockHolder(client: Client): Promise<string> {
  const { rows } = await client.query<{ application_name: string }>(
    `SELECT a.application_name
       FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory' AND l.granted AND l.pid <> pg_backend_pid()
        AND l.classid = (($1::bigint >> 32) & 4294967295)::oid AND l.objid = ($1::bigint & 4294967295)::oid
        AND l.objsubid = 1
      LIMIT 1`,
    [MIGRATE_ADVISORY_LOCK_KEY],
  );
  const name = rows[0]?.application_name;
  return name === undefined || name === '' ? 'an unnamed session' : name;
}

/** Polls `pg_try_advisory_lock` (a blocking `pg_advisory_lock` would wait forever behind a stuck holder). */
async function takeLock(client: Client, lockWaitMs: number): Promise<void> {
  const deadline = Date.now() + lockWaitMs;
  for (;;) {
    const { rows } = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS locked', [
      MIGRATE_ADVISORY_LOCK_KEY,
    ]);
    if (rows[0]?.locked === true) return;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new MigrationLockTimeoutError(lockWaitMs, await lockHolder(client));
    await delay(Math.min(MIGRATE_LOCK_POLL_MS, remaining));
  }
}

/**
 * Runs `work` while holding the migrate advisory lock on a direct connection of its own (session-level
 * advisory locks do not survive PgBouncer's transaction pooling). A second caller polls for the lock up to
 * `lockWaitMs`; ending the connection releases it even if the explicit unlock fails.
 */
async function withMigrateLock<T>(env: AppEnv, lockWaitMs: number, work: () => Promise<T>): Promise<T> {
  const { username, ...fields } = toPostgresFields(env.DATABASE_URL_DIRECT);
  const client = new Client({
    ...fields,
    user: username,
    application_name: MIGRATE_LOCK_APPLICATION_NAME,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
  });
  await client.connect();
  try {
    await takeLock(client, lockWaitMs);
    try {
      return await work();
    } finally {
      await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATE_ADVISORY_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

/** The error's message lists only the first failures, so each one is logged here. */
function logConvergeFailures(error: unknown): void {
  if (!(error instanceof RbacConvergeFailedError)) return;
  for (const { businessId, reason } of error.failures) {
    Logger.error(`Business ${businessId} failed to converge: ${reason}`, CONVERGE_LOG_CONTEXT);
  }
}

/**
 * Makes every live administrator holding a role a team member (D215), after the roles converged; a business that
 * fails is logged by id and rejects this once the others are done, as for the roles.
 */
async function convergeMembers(app: INestApplicationContext): Promise<MemberConvergeReport> {
  try {
    return await app.get(TeamConvergeService).convergeMembers(asTeamContext(await superadminContext(app)));
  } catch (error: unknown) {
    if (error instanceof TeamConvergeFailedError) {
      for (const { businessId, reason } of error.failures) {
        Logger.error(`Business ${businessId} failed to converge its members: ${reason}`, CONVERGE_LOG_CONTEXT);
      }
    }
    throw error;
  }
}

/**
 * Converges the built-in roles of every business (D57); a business that fails rejects this, so the migrate exits
 * non-zero once the others are done. The worker then stays up long enough for the sessions' delayed second eviction.
 */
async function convergeRoles(app: INestApplicationContext): Promise<ConvergeReport> {
  let flushed = true;
  try {
    const report = await app.get(RbacConvergeService).convergeAll(asOperationContext(await superadminContext(app)));
    flushed = report.changed > 0;
    return report;
  } catch (error: unknown) {
    logConvergeFailures(error);
    throw error;
  } finally {
    if (flushed) await delay(SESSION_FLUSH_SETTLE_MS);
  }
}

/**
 * Makes the next partitions and drops the expired ones, once after the migrations (D106), so a fresh database has
 * today's partitions before the first api request. A table that fails rejects this and the migrate exits non-zero.
 */
async function maintainPartitions(app: INestApplicationContext): Promise<void> {
  const report = await app.get(PartitionMaintenanceService).maintain(new Date());
  Logger.info(
    `Partitions: ${String(report.created.length)} created, ${String(report.dropped.length)} dropped, ` +
      `${String(report.kept.length)} kept, ${String(report.scrubbed.length)} scrubbed`,
    CONVERGE_LOG_CONTEXT,
  );
}

/** Inserts the flags that do not exist yet; a value staff changed is never overwritten (D116). */
async function seedFlags(app: INestApplicationContext): Promise<void> {
  await app.get(FlagSeedService).converge();
}

/**
 * The `migrate` role: under the migrate advisory lock, runs the pending migrations over the direct
 * connection (a missing migrations table is created on the first run), then boots a worker without its job
 * queue to seed the platform defaults, converge the roles of existing businesses and then their members, and maintain the partitions.
 * Concurrent runs are serialised, so each migration applies once; one that cannot get the lock in time throws
 * {@link MigrationLockTimeoutError}.
 */
export async function runMigrate(env: AppEnv, options: { lockWaitMs?: number } = {}): Promise<MigrateReport> {
  return withMigrateLock(env, options.lockWaitMs ?? MIGRATE_LOCK_WAIT_MS, async () => {
    const migrationsRun = await runMigrationsOrThrow(buildVendureConfig(env, 'migrate'));
    const worker = await bootstrapWorker(buildVendureConfig(env, 'migrate'));
    try {
      const seed = await seedPlatformDefaults(worker.app);
      const rbacConverged = await convergeRoles(worker.app);
      const teamConverged = await convergeMembers(worker.app);
      await maintainPartitions(worker.app);
      await seedFlags(worker.app);
      return { migrationsRun, seed, rbacConverged, teamConverged };
    } finally {
      await worker.app.close();
    }
  });
}
