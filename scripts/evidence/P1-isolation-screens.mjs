// Browser part of scripts/evidence/P1-isolation.sh: owner A's dashboard, store switcher, settings, roles, activity log
// (and, with EV_WITH_TEAM=1, team) in {ar, en} x {desktop 1280, mobile 390}, plus B's store by direct URL (not found).
// Every screen is checked for none of B's names and for A's own.
//
//   node P1-isolation-screens.mjs <dashboard-url> <out-dir> <world.json>
//
// world.json is the runner's, in the evidence work dir: A's owner credentials (never printed), A's and B's names.
/* global process, console, URL, document, window */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MERCHANT_NOT_FOUND_TEST_ID,
  SHELL_SKELETON_TEST_ID,
  STORE_SWITCHER_TEST_ID,
} from '../../plugins/merchant-shell/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir, worldFile] = process.argv.slice(2);
if (!baseArg || !outDir || !worldFile) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const world = JSON.parse(readFileSync(worldFile, 'utf8'));
// The session helper reads the owner's password from this variable; it is this run's synthetic password.
process.env.DEMO_OWNER_PASSWORD = world.ownerA.password;

const MAX_BYTES = 300 * 1024;
const STEP_TIMEOUT_MS = 30_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const PAGES = [
  { name: 'home', path: '/home', ready: (page) => byTestId(page, SHELL_SKELETON_TEST_ID).waitFor() },
  { name: 'settings', path: '/settings' },
  { name: 'roles', path: '/team/roles' },
  { name: 'activity-log', path: '/team/activity-log' },
  ...(process.env.EV_WITH_TEAM === '1' ? [{ name: 'team', path: '/team' }] : []),
];

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}
const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);
const open = (page, path) => page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT_MS });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }',
  });
}

/** Shoots the page after checking its direction, its width, that none of B's names shows, and that A's `must` do. */
async function shoot(page, name, lang, must = []) {
  await settle(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  const text = await page.evaluate(() => document.body.innerText);
  const leaked = world.namesB.filter((value) => text.includes(value));
  if (leaked.length > 0) fail(`${name}: shows B's ${leaked.join(', ')}`);
  const missing = must.filter((value) => !text.includes(value));
  if (missing.length > 0) fail(`${name}: does not show A's ${missing.join(', ')}`);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  console.error(`shot ${name}: none of B's names, A's own shown`);
}

async function signedIn(browser, lang, vp) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  // The stock user menu lives in the sidebar, which a phone-width page hides: sign in wide, then narrow.
  await page.setViewportSize(VIEWPORTS.desktop.viewport);
  await loginAsOwner(page, base, world.ownerA.email);
  await setDisplayLanguage(page, lang);
  await page.setViewportSize(VIEWPORTS[vp].viewport);
  return page;
}

async function shootOwnerA(browser, lang, vp) {
  const tag = `${lang}-${vp}`;
  const page = await signedIn(browser, lang, vp);
  try {
    for (const { name, path, ready } of PAGES) {
      await open(page, path);
      if (ready) await ready(page);
      await shoot(page, `${name}-${tag}`, lang);
    }
    await open(page, '/home');
    await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    await byTestId(page, STORE_SWITCHER_TEST_ID).click();
    await page.getByRole('menu').waitFor();
    await shoot(page, `switcher-open-${tag}`, lang, world.namesA.stores);
    await page.keyboard.press('Escape');

    await open(page, `/stores/${world.storeB.id}/products`);
    await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
    await shoot(page, `not-found-store-of-b-${tag}`, lang);
  } finally {
    await page.context().close();
  }
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const lang of LANGS) {
    for (const vp of Object.keys(VIEWPORTS)) await shootOwnerA(browser, lang, vp);
  }
} finally {
  await browser.close();
}
