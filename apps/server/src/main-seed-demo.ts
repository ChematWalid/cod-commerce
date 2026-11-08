import { bootstrapWorker, DefaultLogger, Logger } from '@vendure/core';
import { loadEnv } from './config/env';
import { buildVendureConfig } from './config/vendure-config';
import { DemoSeedRefusedError, seedDemoBusinesses } from './seed/seed-demo-businesses';

const LOG_CONTEXT = 'seed-demo';

/** Runs the demo seed once (`ROLE=migrate`, after `migrate`): one JSON line on success. */
async function main(): Promise<void> {
  Logger.useLogger(new DefaultLogger());
  const env = loadEnv();
  if (env.APP_ENV === 'production') throw new DemoSeedRefusedError('APP_ENV is production');
  const worker = await bootstrapWorker(buildVendureConfig(env, 'migrate'));
  try {
    const report = await seedDemoBusinesses(worker.app, env);
    process.stdout.write(`${JSON.stringify({ event: 'seed-demo.done', ...report })}\n`);
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
