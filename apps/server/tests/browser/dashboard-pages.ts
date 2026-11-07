import { join } from 'node:path';
import { SHELL_PLACEHOLDER_PATH, SHELL_PLACEHOLDER_TEST_ID } from '@cod/plugin-merchant-shell';

/** A dashboard page the RTL browser test opens in Arabic and in English. */
export interface DashboardPageUnderTest {
  /** The route below the dashboard base, e.g. `/merchant-shell`. */
  readonly path: string;
  /** The `data-testid` that marks the page as rendered. */
  readonly readyTestId: string;
  /** The screenshot name part: `dashboard-<slug>-<lang>.png`. */
  readonly slug: string;
}

/** Every page the RTL check covers (ADR 0010: RTL is verified on every page we expose). Task 18 appends here. */
export const DASHBOARD_PAGES_UNDER_TEST: readonly DashboardPageUnderTest[] = [
  { path: SHELL_PLACEHOLDER_PATH, readyTestId: SHELL_PLACEHOLDER_TEST_ID, slug: 'merchant-shell' },
];

/** The dashboard of a host-run api (`pnpm --filter @cod/server dev`). */
const DEFAULT_DASHBOARD_URL = 'http://localhost:3100/dashboard';

/** The git-ignored folder of this package that receives the screenshots. */
const DEFAULT_SCREENSHOT_DIR = join(__dirname, '../../test-results');

/** The dashboard base URL under test, without a trailing slash (`DASHBOARD_URL`). */
export const DASHBOARD_URL = (process.env['DASHBOARD_URL'] ?? DEFAULT_DASHBOARD_URL).replace(/\/$/, '');

/** Where the screenshots go (`SCREENSHOT_DIR`). */
export const SCREENSHOT_DIR = process.env['SCREENSHOT_DIR'] ?? DEFAULT_SCREENSHOT_DIR;
