import { join } from 'node:path';
import { generateMigration } from '@vendure/core';
import { loadEnv } from '../config/env';
import { buildVendureConfig } from '../config/vendure-config';

/** Where migrations are committed; `db.config.ts` loads them from the same folder. */
const MIGRATIONS_DIR = join(__dirname, '../migrations');

/**
 * Writes a migration for the difference between the `migrate` role's entities and the database at
 * `DATABASE_URL_DIRECT`. Usage: `pnpm --filter @cod/server migration:generate <name>`.
 */
async function main(): Promise<void> {
  const name = process.argv[2];
  if (name === undefined || name === '') {
    throw new Error('Usage: migration:generate <name>');
  }
  await generateMigration(buildVendureConfig(loadEnv(), 'migrate'), { name, outputDir: MIGRATIONS_DIR });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
