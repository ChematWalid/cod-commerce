const TYPEORM_VALUE_IMPORT = /^import \{\s*MigrationInterface,\s*QueryRunner\s*\} from "typeorm";/m;
const TYPEORM_TYPE_IMPORT = 'import type { MigrationInterface, QueryRunner } from "typeorm";';
const ANY_PROMISE = /Promise<any>/g;

/**
 * Rewrites the source Vendure generates to what the repo commits: the `typeorm` import becomes type-only (Node's
 * type stripping loads migrations under Vitest and would keep a value import of two types) and `up`/`down` return
 * `Promise<void>` (`no-explicit-any`). Throws when the import is not the expected one, so a changed Vendure
 * template fails the generator instead of writing a file that needs hand edits.
 */
export function normalizeGeneratedMigration(source: string): string {
  if (!TYPEORM_VALUE_IMPORT.test(source)) {
    throw new Error('Unexpected migration template: the typeorm import was not found');
  }
  return source.replace(TYPEORM_VALUE_IMPORT, TYPEORM_TYPE_IMPORT).replace(ANY_PROMISE, 'Promise<void>');
}
