import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Unit tests: the domain, the use cases with fakes and the in-memory adapter's contract (`pnpm test`). */
export default defineConfig({
  ...vendurePreset,
  test: {
    ...vendurePreset.test,
    setupFiles: ['tests/setup-env.ts'],
    // A test that asserts nothing fails instead of passing blind (#172, D2118).
    expect: { ...vendurePreset.test?.expect, requireAssertions: true },
  },
});
