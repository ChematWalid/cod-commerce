import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Unit tests: no data service needed (`pnpm test`). */
export default defineConfig({
  ...vendurePreset,
  test: { ...vendurePreset.test, setupFiles: ['tests/setup-env.ts'] },
});
