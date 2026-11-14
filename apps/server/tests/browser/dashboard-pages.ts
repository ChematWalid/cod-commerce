import { join } from 'node:path';
import { DASHBOARD_BASE_PATH } from '../../src/config/dashboard-route';
import { DEV_API_PORT } from '../../src/config/ports';
import { PRODUCT_LIST_TEST_ID } from '@cod/plugin-catalog';
import { BUSINESS_CARD_TEST_ID, SETTINGS_PATH } from '@cod/plugin-merchant-shell';

/** A dashboard page the RTL browser test opens in Arabic and in English. */
export interface DashboardPageUnderTest {
  /** The route below the dashboard base, e.g. `/settings`. */
  readonly path: string;
  /** The `data-testid` that marks the page as rendered. */
  readonly readyTestId: string;
  /** The screenshot name part: `dashboard-<slug>-<lang>.png`. */
  readonly slug: string;
}

/** Every page the RTL check covers (ADR 0010: RTL is verified on every page we expose). New pages append here. */
export const DASHBOARD_PAGES_UNDER_TEST: readonly DashboardPageUnderTest[] = [
  { path: '/stores/active/products', readyTestId: PRODUCT_LIST_TEST_ID, slug: 'products' },
  { path: SETTINGS_PATH, readyTestId: BUSINESS_CARD_TEST_ID, slug: 'settings' },
];

/** The dashboard of a host-run api (`pnpm --filter @cod/server dev`). */
const DEFAULT_DASHBOARD_URL = `http://localhost:${String(DEV_API_PORT)}${DASHBOARD_BASE_PATH}`;

/** The git-ignored folder of this package that receives the screenshots. */
const DEFAULT_SCREENSHOT_DIR = join(__dirname, '../../test-results');

/** The dashboard base URL under test, without a trailing slash (`DASHBOARD_URL`). */
export const DASHBOARD_URL = (process.env['DASHBOARD_URL'] ?? DEFAULT_DASHBOARD_URL).replace(/\/$/, '');

/** Where the screenshots go (`SCREENSHOT_DIR`). */
export const SCREENSHOT_DIR = process.env['SCREENSHOT_DIR'] ?? DEFAULT_SCREENSHOT_DIR;
