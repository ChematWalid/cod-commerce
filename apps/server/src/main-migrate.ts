import { DefaultLogger, Logger } from '@vendure/core';
import { loadEnv } from './config/env';
import { runMigrate } from './roles/migrate.role';

const LOG_CONTEXT = 'migrate';

/** The `migrate` role's entry point: one JSON line on success (exit 0), the stack on failure (exit 1). */
async function main(): Promise<void> {
  // Vendure logs nothing until it boots; this logger reports an error raised before that (bad env, wrong role).
  Logger.useLogger(new DefaultLogger());
  const env = loadEnv();
  if (env.ROLE !== 'migrate') {
    throw new Error(`main-migrate needs ROLE=migrate, got ROLE=${env.ROLE}`);
  }
  const report = await runMigrate(env);
  process.stdout.write(`${JSON.stringify({ event: 'migrate.done', ...report })}\n`);
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    Logger.error(
      error instanceof Error ? error.message : String(error),
      LOG_CONTEXT,
      error instanceof Error ? error.stack : undefined,
    );
    process.exit(1);
  },
);
