import { vendurePreset } from '@cod/config/vitest/vendure';
import { defineConfig } from 'vitest/config';

/** Lines of the pure engine (`domain/`) the unit tests must cover (D2430, brief target ≥ 90 %). */
const DOMAIN_LINE_COVERAGE_PERCENT = 90;

/** Unit tests: the pure engine, the use cases with fakes and the plugin metadata (`pnpm test`). */
export default defineConfig({
  ...vendurePreset,
  test: {
    ...vendurePreset.test,
    setupFiles: ['tests/setup-env.ts'],
    expect: { ...vendurePreset.test?.expect, requireAssertions: true },
    coverage: {
      provider: 'v8',
      include: ['domain/**'],
      thresholds: { lines: DOMAIN_LINE_COVERAGE_PERCENT },
    },
  },
});
