import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

// The Vendure preset: the config tests import `@vendure/core`, which needs its SWC decorator metadata and
// its server conditions without the bundler-only `module` condition.
const { test: presetTest = {}, ...resolution } = vendurePreset;

/** Integration and end-to-end tests: they need Postgres, Valkey or a running server (`pnpm test:integration`). */
const E2E_INCLUDE = ['tests/**/*.{int,e2e}.test.ts'];

// Both projects extend this root, which carries the preset's resolution and no `include`/`exclude`:
// Vitest concatenates arrays when a project extends its root, so each project sets its own.
export default defineConfig({
  ...resolution,
  test: {
    environment: presetTest.environment,
    env: presetTest.env,
    pool: presetTest.pool,
    fileParallelism: presetTest.fileParallelism,
    testTimeout: presetTest.testTimeout,
    hookTimeout: presetTest.hookTimeout,
    setupFiles: ['tests/setup-env.ts'],
    projects: [
      { extends: true, test: { name: 'unit', include: presetTest.include, exclude: presetTest.exclude } },
      { extends: true, test: { name: 'e2e', include: E2E_INCLUDE, exclude: ['**/node_modules/**'] } },
    ],
  },
});
