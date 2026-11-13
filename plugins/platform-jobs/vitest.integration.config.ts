import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Integration tests: the semaphore and the breaker on the compose Valkey, database 12 (`pnpm test:integration`). */
export default defineConfig({
  ...vendurePreset,
  test: {
    ...vendurePreset.test,
    include: ['tests/**/*.int.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['tests/setup-env.ts'],
  },
});
