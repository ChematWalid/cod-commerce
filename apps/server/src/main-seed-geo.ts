import { GeoSeedService } from '@cod/plugin-geo';
import { bootstrapWorker, DefaultLogger, Logger } from '@vendure/core';
import { loadEnv } from './config/env';
import { buildVendureConfig } from './config/vendure-config';

const LOG_CONTEXT = 'seed-geo';

/**
 * Converges the wilaya and commune tables on the geo seed once (`ROLE=migrate`, after `migrate`, which runs the same
 * converge): one JSON line on success. Safe in every environment: it only upserts reference data (D3116).
 */
async function main(): Promise<void> {
  Logger.useLogger(new DefaultLogger());
  const worker = await bootstrapWorker(buildVendureConfig(loadEnv(), 'migrate'));
  try {
    const report = await worker.app.get(GeoSeedService).converge();
    process.stdout.write(`${JSON.stringify({ event: 'seed-geo.done', ...report })}\n`);
  } finally {
    await worker.app.close();
  }
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
