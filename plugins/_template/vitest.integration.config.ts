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
    // A test that asserts nothing fails instead of passing blind (#172, D2118).
    expect: { ...vendurePreset.test?.expect, requireAssertions: true },
  },
});
