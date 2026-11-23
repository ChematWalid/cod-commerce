import type { INestApplication } from '@nestjs/common';
import { TransactionalConnection } from '@vendure/core';
import { StorefrontSearch1795600000001 } from '../../../../apps/server/src/migrations/1795600000001-storefront-search';

/** The contrib extensions the search migrations need (`StorefrontApi1795600000000` creates them in a real database). */
const SEARCH_EXTENSIONS = ['pg_trgm', 'unaccent', 'btree_gin'] as const;

/**
 * Gives a test database the committed search schema: the test kit builds tables with `synchronize`, which knows neither
 * the extensions, the SQL normaliser nor the trigram index. The synonym table `synchronize` made is dropped first, so the
 * migration's own `up` runs whole, and the tests read the SQL production runs.
 */
export async function applySearchSchema(app: INestApplication): Promise<void> {
  const runner = app.get(TransactionalConnection).rawConnection.createQueryRunner();
  try {
    for (const extension of SEARCH_EXTENSIONS) await runner.query(`CREATE EXTENSION IF NOT EXISTS ${extension}`);
    await runner.query('DROP TABLE "storefront_search_synonym"');
    await new StorefrontSearch1795600000001().up(runner);
  } finally {
    await runner.release();
  }
}
