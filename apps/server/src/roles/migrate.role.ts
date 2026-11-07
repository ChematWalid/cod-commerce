import { bootstrapWorker, type MigrationDiagnostic, runMigrations } from '@vendure/core';
import type { AppEnv } from '../config/env';
import { buildVendureConfig } from '../config/vendure-config';
import { seedPlatformDefaults } from '../seed/seed-platform-defaults';
import type { SeedReport } from '../seed/seed.types';

/** The outcome of one `migrate` run. */
export interface MigrateReport {
  migrationsRun: string[];
  seed: SeedReport;
}

/** Running the migrations failed, or left the schema out of step with the entities. */
export class MigrationFailedError extends Error {
  constructor(reason: string) {
    super(`Migrations failed: ${reason}`);
    this.name = 'MigrationFailedError';
  }
}

/**
 * Vendure's `runMigrations` reports a failed migration only by setting `process.exitCode`, and drift only
 * through a diagnostic, so both are turned into an error here instead of letting the seed run on a bad schema.
 */
async function runMigrationsOrThrow(config: ReturnType<typeof buildVendureConfig>): Promise<string[]> {
  const diagnostics: MigrationDiagnostic[] = [];
  const exitCodeBefore = process.exitCode;
  const migrationsRun = await runMigrations(config, { onDiagnostic: (diagnostic) => diagnostics.push(diagnostic) });
  if (process.exitCode !== exitCodeBefore) {
    process.exitCode = exitCodeBefore;
    throw new MigrationFailedError('a migration threw; see the log above');
  }
  if (diagnostics.length > 0) {
    throw new MigrationFailedError(diagnostics.map((diagnostic) => diagnostic.lines.join('\n')).join('\n'));
  }
  return migrationsRun;
}

/**
 * The `migrate` role: runs the pending migrations over the direct connection (a missing migrations table is
 * created on the first run), then boots a worker without its job queue to seed the platform defaults.
 */
export async function runMigrate(env: AppEnv): Promise<MigrateReport> {
  const migrationsRun = await runMigrationsOrThrow(buildVendureConfig(env, 'migrate'));
  const worker = await bootstrapWorker(buildVendureConfig(env, 'migrate'));
  try {
    const seed = await seedPlatformDefaults(worker.app);
    return { migrationsRun, seed };
  } finally {
    await worker.app.close();
  }
}
