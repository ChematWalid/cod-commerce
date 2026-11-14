import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig } from 'vitest/config';

/** A browser launch and a page load take seconds, not milliseconds. */
const BROWSER_TEST_TIMEOUT_MS = 60_000;

/** Browser tests against a running storefront (`pnpm test:browser`), one file at a time. */
export default defineConfig({
  ...unitPreset,
  test: {
    ...unitPreset.test,
    include: ['tests/browser/**/*.browser.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: BROWSER_TEST_TIMEOUT_MS,
    hookTimeout: BROWSER_TEST_TIMEOUT_MS,
    fileParallelism: false,
    // Off until this suite is checked in CI (D2118): it cannot run locally (D218); unit suites keep the preset's guard.
    expect: { ...unitPreset.test?.expect, requireAssertions: false },
  },
});
