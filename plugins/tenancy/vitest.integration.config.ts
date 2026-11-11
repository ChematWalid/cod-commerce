import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Integration tests: a Vendure test server on the compose Postgres (`pnpm test:integration`). */
export default defineConfig({
  ...vendurePreset,
  test: {
    ...vendurePreset.test,
    include: ['tests/**/*.int.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['tests/setup-env.ts'],
    // A test that asserts nothing proves nothing, least of all an isolation row (TEN-10).
    expect: { requireAssertions: true },
  },
});
