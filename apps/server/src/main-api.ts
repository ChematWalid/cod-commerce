import { bootstrap, DefaultLogger, Logger } from '@vendure/core';
import { loadEnv } from './config/env';
import { buildVendureConfig } from './config/vendure-config';

const LOG_CONTEXT = 'api';

/** The `api` role's entry point. It never runs migrations: the `migrate` role does, before the api starts. */
async function main(): Promise<void> {
  // Vendure logs nothing until it boots; this logger reports an error raised before that (bad env, wrong role).
  Logger.useLogger(new DefaultLogger());
  const env = loadEnv();
  if (env.ROLE !== 'api') {
    throw new Error(`main-api needs ROLE=api, got ROLE=${env.ROLE}`);
  }
  await bootstrap(buildVendureConfig(env, 'api'));
}

main().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.message : String(error),
    LOG_CONTEXT,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
