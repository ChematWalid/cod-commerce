import { unitPreset } from '@cod/config/vitest/unit';
import { defineConfig } from 'vitest/config';

/** The first request to a fresh `next start` compiles nothing, but the probe waits for the server to listen. */
const SMOKE_TIMEOUT_MS = 60_000;

/** Smoke tests against a running storefront (`next start`, `STOREFRONT_URL`), over real HTTP. */
export default defineConfig({
  ...unitPreset,
  test: {
    ...unitPreset.test,
    include: ['tests/smoke/**/*.smoke.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: SMOKE_TIMEOUT_MS,
    hookTimeout: SMOKE_TIMEOUT_MS,
  },
});
