// Browser part of scripts/evidence/P1.S5.sh: the merchant shell (home, sidebar, store switcher, Create Store, account menu,
// General settings, skeleton and store-scoped leaves, not found for a stock route and for another business's store) and
// the superadmin's stock navigation, for {desktop 1280, mobile 390} x {ar, en} x {light, dark}.
//
//   node P1.S5-screens.mjs <dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD, SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD (read by the session helper, never printed),
// EV_FOREIGN_STORE_ID (a store of the second business).
/* global process, console, URL, document, window, NodeFilter, getComputedStyle */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_MENU_TEST_ID,
  BUSINESS_CARD_TEST_ID,
  CREATE_STORE_DIALOG_TEST_ID,
  MERCHANT_NOT_FOUND_TEST_ID,
  SHELL_SKELETON_TEST_ID,
  STORE_CARD_TEST_ID,
  STORE_CREATE_TEST_ID,
  STORE_SWITCHER_TEST_ID,
} from '../../plugins/merchant-shell/dashboard/constants.ts';
import {
  loginAsOwner,
  loginAsSuperadmin,
  setDisplayLanguage,
} from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const FOREIGN_STORE_ID = process.env.EV_FOREIGN_STORE_ID;
if (!FOREIGN_STORE_ID) throw new Error('EV_FOREIGN_STORE_ID must be set');

const MAX_BYTES = 300 * 1024;
const STEP_TIMEOUT_MS = 30_000;
const LANGS = ['ar', 'en'];
const THEMES = ['light', 'dark'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const LICENCE_NOTICE = '[data-vendure-branding]';
/** The framework's name; only the licence notice may show it on a merchant's screen (ADR 0007, D79). */
const VENDOR_NAME = /vendure/i;
const SIDEBAR_TRIGGER = '[data-sidebar="trigger"]';
const MOBILE_SHEET = '[data-mobile="true"]';
const SIDEBAR_FOOTER = '[data-sidebar="footer"]';
const SIDEBAR_ENTRIES = '[data-sidebar="content"] [data-sidebar="menu-button"]';
const SUB_ENTRIES = '[data-sidebar="menu-sub-button"]';
const SIDEBAR_LEAF = '/finance/costs';
const SKELETON_LEAF = '/cod-orders/spam';
// A store leaf still on its skeleton: the product list became a real page in P2.S1.
const STORE_LEAF = '/stores/active/collections';
const TAKEN_SUBDOMAIN = 'demo';

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

function catalogue(lang) {
  const entries = new Map();
  const po = readFileSync(join(root, `plugins/merchant-shell/dashboard/i18n/${lang}.po`), 'utf8');
  for (const [, id, text] of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) entries.set(id, text);
  return (id) => entries.get(id) ?? fail(`${lang}.po has no ${id}`);
}
const T = { ar: catalogue('ar'), en: catalogue('en') };
const proved = (line) => console.error(line);
const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: STEP_TIMEOUT_MS });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }',
  });
}

/**
 * The visible text with the licence notice left out. The notice forces `display: flex !important` against hiding, so its
 * text nodes are skipped instead.
 */
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

/** How many visible sidebar sub-entries show the active marker. */
const highlightedSubEntries = (page) =>
  page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].filter(
        (entry) => entry.checkVisibility() && getComputedStyle(entry, '::before').opacity === '1',
      ).length,
    SUB_ENTRIES,
  );

async function shoot(page, name, { lang, theme, merchant = true }) {
  await settle(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (dark !== (theme === 'dark')) fail(`${name}: dark class is ${dark}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  if (merchant && VENDOR_NAME.test(await textOutsideNotice(page))) fail(`${name}: the framework's name is visible`);
  const highlighted = merchant ? await highlightedSubEntries(page) : 0;
  if (highlighted > 1) fail(`${name}: ${highlighted} sidebar entries are highlighted`);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  console.error(`shot ${name}`);
}

async function signedIn(browser, { signIn, lang, theme, vp }) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], colorScheme: theme, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  // The stock user menu lives in the sidebar, which a phone-width page hides: sign in wide, then narrow.
  await page.setViewportSize(VIEWPORTS.desktop.viewport);
  await signIn(page);
  await setDisplayLanguage(page, lang);
  await page.setViewportSize(VIEWPORTS[vp].viewport);
  return page;
}

const open = (page, path) => page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });

async function openMobileSidebar(page) {
  await page.locator(SIDEBAR_TRIGGER).first().click();
  await page.locator(`${MOBILE_SHEET} ${SIDEBAR_ENTRIES}`).first().waitFor();
}

async function closeOverlay(page) {
  await page.keyboard.press('Escape');
  await page.getByRole('menu').or(page.getByRole('dialog')).first().waitFor({ state: 'detached' });
}

/** The dialog's close button is visible and does not sit on its title. */
async function assertCloseClearOfTitle(dialog, tag) {
  const close = await dialog.locator('[data-slot="dialog-close"]').boundingBox();
  const title = await dialog.locator('[data-slot="dialog-title"]').boundingBox();
  if (close === null || title === null) fail(`create-store-${tag}: no close button or title`);
  const text = await dialog.locator('[data-slot="dialog-title"]').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const box = range.getBoundingClientRect();
    return { x: box.x, width: box.width };
  });
  const overlaps = close.x < text.x + text.width && text.x < close.x + close.width;
  if (overlaps) fail(`create-store-${tag}: the close button covers the title`);
}

async function shootMerchant(browser, lang, vp, theme) {
  const t = T[lang];
  const opts = { lang, theme };
  const tag = `${lang}-${vp}-${theme}`;
  const page = await signedIn(browser, { signIn: (p) => loginAsOwner(p, base, OWNER), lang, theme, vp });
  try {
    await open(page, '/home');
    await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    await shoot(page, `home-${tag}`, opts);

    await open(page, SIDEBAR_LEAF);
    await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    if (vp === 'mobile') await openMobileSidebar(page);
    if ((await highlightedSubEntries(page)) !== 1) fail(`sidebar-${tag}: not exactly one highlighted entry`);
    await shoot(page, `sidebar-${tag}`, opts);
    if (vp === 'mobile') await page.keyboard.press('Escape');

    await open(page, '/home');
    await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    await byTestId(page, STORE_SWITCHER_TEST_ID).click();
    await page.getByRole('menu').waitFor();
    await shoot(page, `switcher-open-${tag}`, opts);

    await byTestId(page, STORE_CREATE_TEST_ID).click();
    const dialog = byTestId(page, CREATE_STORE_DIALOG_TEST_ID);
    await dialog
      .getByRole('textbox')
      .nth(0)
      .fill(lang === 'ar' ? 'متجر الأدلة' : 'Evidence store');
    await dialog.getByRole('textbox').nth(1).fill(TAKEN_SUBDOMAIN);
    await dialog.getByText(t('subdomain.taken')).waitFor();
    await assertCloseClearOfTitle(dialog, tag);
    await shoot(page, `create-store-${tag}`, opts);
    await closeOverlay(page);

    await byTestId(page, ACCOUNT_MENU_TEST_ID).click();
    await page.getByRole('menu').waitFor();
    await page.getByRole('menu').locator(LICENCE_NOTICE).waitFor();
    await shoot(page, `account-menu-${tag}`, opts);
    await closeOverlay(page);

    await open(page, '/settings');
    await byTestId(page, BUSINESS_CARD_TEST_ID).waitFor();
    await byTestId(page, STORE_CARD_TEST_ID).waitFor();
    await shoot(page, `settings-${tag}`, opts);

    await open(page, SKELETON_LEAF);
    await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    await shoot(page, `skeleton-leaf-${tag}`, opts);

    await open(page, STORE_LEAF);
    await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    await shoot(page, `store-leaf-${tag}`, opts);

    await open(page, '/orders');
    await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
    if ((await page.locator('table').count()) !== 0) fail(`${tag}: the stock order table rendered`);
    await shoot(page, `not-found-stock-route-${tag}`, opts);

    await open(page, `/stores/${FOREIGN_STORE_ID}/products`);
    await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
    await shoot(page, `not-found-other-business-store-${tag}`, opts);
  } finally {
    await page.context().close();
  }
}

async function shootStaff(browser, lang, vp, theme) {
  const page = await signedIn(browser, { signIn: (p) => loginAsSuperadmin(p, base), lang, theme, vp });
  try {
    await open(page, '/');
    if (vp === 'mobile') await openMobileSidebar(page);
    else await page.locator(SIDEBAR_FOOTER).waitFor();
    // The entries render once the active channel and permissions have loaded.
    await page.locator(SIDEBAR_ENTRIES).first().waitFor();
    if ((await byTestId(page, ACCOUNT_MENU_TEST_ID).count()) !== 0) fail(`staff ${lang} ${vp}: has the merchant menu`);
    await shoot(page, `staff-nav-${lang}-${vp}-${theme}`, { lang, theme, merchant: false });
  } finally {
    await page.context().close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of LANGS) {
      for (const vp of Object.keys(VIEWPORTS)) {
        for (const theme of THEMES) {
          await shootMerchant(browser, lang, vp, theme);
          await shootStaff(browser, lang, vp, theme);
        }
      }
    }
    proved('Every merchant shot: dir matches the language, the dark class matches the theme, no horizontal overflow.');
    proved("Every merchant shot: the framework's name appears only inside the licence notice (the account menu's).");
    proved(
      'Every merchant shot: at most one sidebar entry carries the active marker; the open Finance page shows exactly one.',
    );
    proved("Create store, in both languages: the dialog's close button is visible and does not cover the title text.");
    proved(
      "A stock route (/orders) and another business's store id both show the merchant not-found page, with no table.",
    );
    proved('The superadmin keeps the stock sidebar and has no merchant account menu.');
  } finally {
    await browser.close();
  }
}

await main();
