import { bootstrapWorker, DefaultLogger, Logger } from '@vendure/core';
import { loadEnv } from './config/env';
import { buildVendureConfig } from './config/vendure-config';

const LOG_CONTEXT = 'worker';

/**
 * The `worker` role's entry point: consumes the job queues and runs the scheduler. Its health probes are
 * served by `PlatformHealthPlugin` on `WORKER_HEALTH_PORT`. It never runs migrations.
 */
async function main(): Promise<void> {
  // Vendure logs nothing until it boots; this logger reports an error raised before that (bad env, wrong role).
  Logger.useLogger(new DefaultLogger());
  const env = loadEnv();
  if (env.ROLE !== 'worker') {
    throw new Error(`main-worker needs ROLE=worker, got ROLE=${env.ROLE}`);
  }
  const worker = await bootstrapWorker(buildVendureConfig(env, 'worker'));
  await worker.startJobQueue();
}

main().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : String(error),
    LOG_CONTEXT,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
