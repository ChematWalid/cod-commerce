import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig } from 'vitest/config';

const { test: unitTest = {}, ...resolution } = unitPreset;

/** Integration and end-to-end tests: they need Postgres, Valkey or a running server (`pnpm test:integration`). */
const E2E_INCLUDE = ['tests/**/*.{int,e2e}.test.ts'];

// Both projects extend this root, which carries the preset's resolution and no `include`/`exclude`:
// Vitest concatenates arrays when a project extends its root, so each project sets its own.
export default defineConfig({
  ...resolution,
  test: {
    environment: unitTest.environment,
    env: unitTest.env,
    setupFiles: ['tests/setup-env.ts'],
    projects: [
      { extends: true, test: { name: 'unit', include: unitTest.include, exclude: unitTest.exclude } },
      { extends: true, test: { name: 'e2e', include: E2E_INCLUDE, exclude: ['**/node_modules/**'] } },
    ],
  },
});
