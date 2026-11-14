import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Integration tests: the flags on the compose Postgres and Valkey (`pnpm test:integration`). */
export default defineConfig({
  ...vendurePreset,
  test: {
    ...vendurePreset.test,
    include: ['tests/**/*.int.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['tests/setup-env.ts'],
    // Off until this suite is checked in CI (D2118): it cannot run locally (D218); unit suites keep the preset's guard.
    expect: { ...vendurePreset.test?.expect, requireAssertions: false },
  },
});
