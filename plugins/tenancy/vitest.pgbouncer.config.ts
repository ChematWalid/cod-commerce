import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** PgBouncer checks (A13): needs `DATABASE_URL` on a transaction-mode pool of size 1 (`test:pgbouncer`). */
export default defineConfig({
  ...vendurePreset,
  test: {
    ...vendurePreset.test,
    include: ['tests/pgbouncer/**/*.pgbouncer.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['tests/setup-env.ts'],
  },
});
