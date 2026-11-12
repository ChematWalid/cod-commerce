import { setTimeout as delay } from 'node:timers/promises';
import {
  asOperationContext,
  type ConvergeReport,
  RbacConvergeFailedError,
  RbacConvergeService,
  SESSION_FLUSH_SETTLE_MS,
} from '@cod/plugin-rbac';
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
import { MIGRATE_ADVISORY_LOCK_KEY, MIGRATE_LOCK_APPLICATION_NAME } from './migrate.constants';

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

/**
 * Runs `work` while holding the migrate advisory lock on a direct connection of its own (session-level
 * advisory locks do not survive PgBouncer's transaction pooling). A second caller waits for the lock; ending
 * the connection releases it even if the explicit unlock fails.
 */
async function withMigrateLock<T>(env: AppEnv, work: () => Promise<T>): Promise<T> {
  const { username, ...fields } = toPostgresFields(env.DATABASE_URL_DIRECT);
  const client = new Client({
    ...fields,
    user: username,
    application_name: MIGRATE_LOCK_APPLICATION_NAME,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
  });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATE_ADVISORY_LOCK_KEY]);
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
 * The `migrate` role: under the migrate advisory lock, runs the pending migrations over the direct
 * connection (a missing migrations table is created on the first run), then boots a worker without its job
 * queue to seed the platform defaults, converge the roles of existing businesses and then their members. Concurrent runs are serialised, so each migration applies once.
 */
export async function runMigrate(env: AppEnv): Promise<MigrateReport> {
  return withMigrateLock(env, async () => {
    const migrationsRun = await runMigrationsOrThrow(buildVendureConfig(env, 'migrate'));
    const worker = await bootstrapWorker(buildVendureConfig(env, 'migrate'));
    try {
      const seed = await seedPlatformDefaults(worker.app);
      const rbacConverged = await convergeRoles(worker.app);
      const teamConverged = await convergeMembers(worker.app);
      return { migrationsRun, seed, rbacConverged, teamConverged };
    } finally {
      await worker.app.close();
    }
  });
}
