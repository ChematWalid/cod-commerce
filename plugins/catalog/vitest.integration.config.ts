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
    // On explicitly, not by inheritance (D2118, TEN-10): an isolation test that asserts nothing must fail, whatever
    // the preset later turns off.
    expect: { ...vendurePreset.test?.expect, requireAssertions: true },
  },
});
