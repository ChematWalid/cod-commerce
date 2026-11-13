import { mergeConfig } from 'vitest/config';
import browserConfig from '../../vitest.browser.config';

/**
 * The browser suite with every page under CDP CPU throttling (`BROWSER_CPU_THROTTLE_RATE`, 4 by default), for flake
 * hunts such as #221: from `apps/server`, `pnpm exec vitest run --configLoader runner -c tests/browser/cpu-throttle.vitest.config.ts <files>`.
 * Timeouts stay those of the suite, so a test that only passes with more time fails here too. The setup path is relative
 * to the root, `apps/server`, like the suite's own config (no `__dirname` or `import.meta`: tsc builds this as CommonJS,
 * the runner loads it as ESM).
 */
export default mergeConfig(browserConfig, {
  test: { setupFiles: ['tests/browser/cpu-throttle-setup.ts'] },
});
