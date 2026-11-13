import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vitest/config';
import browserConfig from '../../vitest.browser.config';

/**
 * The browser suite with every page under CDP CPU throttling (`BROWSER_CPU_THROTTLE_RATE`, 4 by default), for flake
 * hunts such as #221: `pnpm exec vitest run --configLoader runner -c tests/browser/cpu-throttle.vitest.config.ts <files>`. Timeouts stay those of
 * the suite, so a test that only passes with more time fails here too.
 */
const here = dirname(fileURLToPath(import.meta.url));

export default mergeConfig(browserConfig, {
  root: join(here, '../..'),
  test: { setupFiles: [join(here, 'cpu-throttle-setup.ts')] },
});
