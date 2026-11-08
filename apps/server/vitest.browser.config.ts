import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** A page load, a sign-in and a language switch in a real Chromium take seconds, not milliseconds. */
const BROWSER_TEST_TIMEOUT_MS = 60_000;

/**
 * Browser tests against a running api (`pnpm test:browser`). They take the Vendure preset's resolution,
 * because they import `@cod/plugin-merchant-shell`, whose entry loads `@vendure/core`, but not its SWC
 * transform: SWC targets ES5 there, and a function handed to `page.evaluate` runs in the browser without the
 * helpers (`_async_to_generator`) it would be rewritten to need. Nothing here runs under Nest injection.
 * One file at a time: they share the superadmin's server-stored display language.
 */
export default defineConfig({
  ...vendurePreset,
  plugins: [],
  test: {
    ...vendurePreset.test,
    include: ['tests/browser/**/*.browser.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['tests/setup-env.ts'],
    testTimeout: BROWSER_TEST_TIMEOUT_MS,
    hookTimeout: BROWSER_TEST_TIMEOUT_MS,
    fileParallelism: false,
  },
});
