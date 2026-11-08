import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/** How many migrations are committed; an empty database runs every one of them. */
export const COMMITTED_MIGRATION_COUNT = readdirSync(join(__dirname, '../../../src/migrations')).filter((file) =>
  file.endsWith('.ts'),
).length;
