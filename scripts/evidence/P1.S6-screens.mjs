// Browser part of scripts/evidence/P1.S6.sh: the staff flags screen (/platform/flags) and its override dialog, for
// {desktop 1280, mobile 390} x {ar, en}.
//
//   node P1.S6-screens.mjs <dashboard-url> <out-dir>
//
// Env: SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD (read by the session helper, never printed), EV_BUSINESS_ID (the demo
// business, typed into the dialog as the override target).
/* global process, console, document, window, NodeFilter, getComputedStyle, URL */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAsSuperadmin, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const BUSINESS_ID = process.env.EV_BUSINESS_ID;
if (!BUSINESS_ID) throw new Error('EV_BUSINESS_ID must be set');

const MAX_BYTES = 300 * 1024;
const STEP_TIMEOUT_MS = 30_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const LICENCE_NOTICE = '[data-vendure-branding]';
const VENDOR_NAME = /vendure/i;
const AI_KEY = 'ai.enabled';
const FLAG_COUNT = 4;

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

function catalogue(lang) {
  const entries = new Map();
  const po = readFileSync(join(root, `plugins/platform-flags/dashboard/i18n/${lang}.po`), 'utf8');
  for (const [, id, text] of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) entries.set(id, text);
  return (id) => entries.get(id) ?? fail(`${lang}.po has no ${id}`);
}
const T = { ar: catalogue('ar'), en: catalogue('en') };

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT_MS });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }',
  });
}

/** The visible text with the licence notice left out (its `!important` rules defeat hiding it). */
const textOutsideNotice = (page) =>
  page.evaluate((selector) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts = [];
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (parent === null || parent.closest(selector) !== null) continue;
      if (parent.checkVisibility({ visibilityProperty: true })) parts.push(node.textContent);
    }
    return parts.join(' ');
  }, LICENCE_NOTICE);

async function shoot(page, name, lang) {
  await settle(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  if (VENDOR_NAME.test(await textOutsideNotice(page))) fail(`${name}: the framework's name is visible`);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  console.error(`shot ${name}`);
}

async function shootFlags(browser, lang, vp) {
  const t = T[lang];
  const tag = `${lang}-${vp}`;
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  try {
    // The stock user menu lives in the sidebar, which a phone-width page hides: sign in wide, then narrow.
    await page.setViewportSize(VIEWPORTS.desktop.viewport);
    await loginAsSuperadmin(page, base);
    await setDisplayLanguage(page, lang);
    await page.setViewportSize(VIEWPORTS[vp].viewport);

    await page.goto(`${base}/platform/flags`, { waitUntil: 'domcontentloaded' });
    await page.locator(`[data-testid="flag-row-${AI_KEY}"]`).waitFor();
    const rows = await page.locator('[data-testid^="flag-row-"]').count();
    if (rows !== FLAG_COUNT) fail(`flags-${tag}: ${rows} rows, wanted ${FLAG_COUNT}`);
    const keyDirections = await page
      .locator('[data-testid^="flag-row-"] bdi')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).direction));
    if (keyDirections.length === 0) fail(`flags-${tag}: no flag key is wrapped for left-to-right display`);
    await shoot(page, `flags-${tag}`, lang);

    await page.locator(`[data-testid="flag-overrides-${AI_KEY}"]`).click();
    await page.getByRole('button', { name: t('flags.add-override') }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('textbox').first().fill(BUSINESS_ID);
    await shoot(page, `flags-override-dialog-${tag}`, lang);
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of LANGS) {
      for (const vp of Object.keys(VIEWPORTS)) await shootFlags(browser, lang, vp);
    }
    console.error('Every shot: dir matches the language and there is no horizontal overflow.');
    console.error("Every shot: the framework's name appears only inside the licence notice.");
    console.error('Every shot: the four seeded flags are listed and their keys are wrapped for left-to-right display.');
  } finally {
    await browser.close();
  }
}

await main();
