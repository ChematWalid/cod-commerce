// Browser part of scripts/evidence/P2.S1.sh: the product list (all, draft, sold out), the product editor (new, variants,
// settings), the media picker and a refused upload, General settings with the logos, and the Create Store dialog after its
// wait ran out, for {desktop 1280, mobile 390} x {ar, en}, on the Arabic demo store.
//
//   node P2.S1-screens.mjs <dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_MATRIX_PRODUCT_ID (the Color x Size product),
// EV_SETTINGS_PRODUCT_ID (the hidden product marked sold out).
/* global process, console, URL, document, window, NodeFilter, Buffer, getComputedStyle, requestAnimationFrame */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CREATE_PRODUCT_TEST_ID,
  PRODUCT_EDITOR_TEST_ID,
  PRODUCT_LIST_TEST_ID,
  PRODUCT_ROW_TEST_ID,
  PRODUCT_TABS_TEST_ID,
  SOLD_OUT_BADGE_TEST_ID,
  SOLD_OUT_ORDERS_TEST_ID,
  VARIANT_ROW_TEST_ID,
} from '../../plugins/catalog/dashboard/constants.ts';
import {
  BUSINESS_LOGO_TEST_ID,
  CREATE_STORE_DIALOG_TEST_ID,
  CREATE_STORE_RECHECK_TEST_ID,
  STORE_CREATE_TEST_ID,
  STORE_LOGO_TEST_ID,
  STORE_SHOW_ADDRESS_TEST_ID,
  STORE_SWITCHER_TEST_ID,
  soldOutOptionTestId,
} from '../../plugins/merchant-shell/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const MATRIX_ID = process.env.EV_MATRIX_PRODUCT_ID;
const SETTINGS_ID = process.env.EV_SETTINGS_PRODUCT_ID;
if (!MATRIX_ID || !SETTINGS_ID) throw new Error('EV_MATRIX_PRODUCT_ID and EV_SETTINGS_PRODUCT_ID must be set');

const MAX_BYTES = 300 * 1024;
/** The tallest shot; the editor's whole form fits in it. */
const MAX_SHOT_HEIGHT = 6000;
const STEP_TIMEOUT_MS = 30_000;
/** The Create Store dialog waits 10 s for the new channel (D87). */
const CREATE_STORE_WAIT_MS = 15_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const STORE = '/stores/active';
const MATRIX_VARIANTS = 4;
const LICENCE_NOTICE = '[data-vendure-branding]';
/** The framework's name; only the licence notice may show it on a merchant's screen (ADR 0007, D79). */
const VENDOR_NAME = /vendure/i;
/** A catalogue id shown as text means a missing translation. */
const RAW_MESSAGE_ID = /\b(catalog|shell|subdomain)\.[a-z]+(-[a-z]+)+\b/;
const CREATE_STORE_OPERATION = /mutation ShellCreateStore\b/;
const NEVER_LISTED_TOKEN = 'never-listed-channel-token';
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>',
);

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

function catalogue(plugin, lang) {
  const entries = new Map();
  const po = readFileSync(join(root, `plugins/${plugin}/dashboard/i18n/${lang}.po`), 'utf8');
  for (const [, id, text] of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) entries.set(id, text);
  return (id) => entries.get(id) ?? fail(`${plugin} ${lang}.po has no ${id}`);
}
const T = { ar: catalogue('catalog', 'ar'), en: catalogue('catalog', 'en') };
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

/** The visible text outside the licence notice, whose `display: flex !important` resists hiding. */
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

/**
 * The dashboard scrolls its content pane, not the document, so a full-page shot stops at the viewport: the viewport is
 * grown to the content's height for the shot, then restored.
 */
async function shootWholeContent(page, file) {
  const viewport = page.viewportSize();
  const height = await page.evaluate(() => {
    const scrollers = [...document.querySelectorAll('*')].filter(
      (element) =>
        /(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight,
    );
    const bottoms = scrollers.map((element) => element.getBoundingClientRect().top + element.scrollHeight);
    return Math.ceil(Math.max(document.documentElement.scrollHeight, ...bottoms));
  });
  await page.setViewportSize({
    width: viewport.width,
    height: Math.min(Math.max(height, viewport.height), MAX_SHOT_HEIGHT),
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: file });
  await page.setViewportSize(viewport);
}

/** `overlay`: a dialog is the subject, so the shot is the viewport, without the blurred page grown behind it. */
async function shoot(page, name, lang, { overlay = false } = {}) {
  await settle(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  const text = await textOutsideNotice(page);
  if (VENDOR_NAME.test(text)) fail(`${name}: the framework's name is visible`);
  const raw = RAW_MESSAGE_ID.exec(text);
  if (raw !== null) fail(`${name}: the untranslated id ${raw[0]} is visible`);
  const file = join(outDir, `${name}.png`);
  if (overlay) await page.screenshot({ path: file });
  else await shootWholeContent(page, file);
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  console.error(`shot ${name}`);
}

async function signedIn(browser, lang, vp) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(STEP_TIMEOUT_MS);
  // The account menu lives in the sidebar, which a phone-width page hides: sign in wide, then narrow.
  await page.setViewportSize(VIEWPORTS.desktop.viewport);
  await loginAsOwner(page, base, OWNER);
  await setDisplayLanguage(page, lang);
  await page.setViewportSize(VIEWPORTS[vp].viewport);
  return page;
}

const open = (page, path) => page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
const tab = (page, label) => byTestId(page, PRODUCT_TABS_TEST_ID).getByRole('tab', { name: label });

async function shootList(page, t, tag, lang) {
  await open(page, `${STORE}/products`);
  await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
  await byTestId(page, PRODUCT_ROW_TEST_ID).nth(5).waitFor();
  await byTestId(page, CREATE_PRODUCT_TEST_ID).waitFor();
  await shoot(page, `product-list-${tag}`, lang);

  await tab(page, t('catalog.tab-draft')).click();
  await page.waitForFunction(
    ([rowSelector, label]) => {
      const rows = [...document.querySelectorAll(rowSelector)];
      return rows.length > 0 && rows.every((row) => row.textContent.includes(label));
    },
    [`[data-testid="${PRODUCT_ROW_TEST_ID}"]`, t('catalog.status-draft')],
  );
  await shoot(page, `product-list-draft-${tag}`, lang);

  await tab(page, t('catalog.tab-sold-out')).click();
  await byTestId(page, SOLD_OUT_ORDERS_TEST_ID).waitFor();
  await byTestId(page, SOLD_OUT_BADGE_TEST_ID).first().waitFor();
  if ((await byTestId(page, PRODUCT_ROW_TEST_ID).count()) !== 1) fail(`product-list-sold-out-${tag}: not one row`);
  await shoot(page, `product-list-sold-out-${tag}`, lang);
}

async function shootEditor(page, t, tag, lang) {
  await open(page, `${STORE}/products/new`);
  await byTestId(page, PRODUCT_EDITOR_TEST_ID).waitFor();
  await page.getByText(t('catalog.editor-new-heading')).first().waitFor();
  await shoot(page, `product-new-${tag}`, lang);

  await open(page, `${STORE}/products/${MATRIX_ID}`);
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${VARIANT_ROW_TEST_ID}"]`, MATRIX_VARIANTS],
  );
  await shoot(page, `product-edit-variants-${tag}`, lang);

  await page.getByRole('button', { name: t('catalog.media-choose') }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: t('catalog.media-pick') })
    .first()
    .waitFor();
  await shoot(page, `media-picker-${tag}`, lang, { overlay: true });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: 'image.svg', mimeType: 'image/svg+xml', buffer: SVG });
  await page.getByText(t('catalog.media-type')).first().waitFor();
  await shoot(page, `media-upload-refused-${tag}`, lang);

  await open(page, `${STORE}/products/${SETTINGS_ID}`);
  await byTestId(page, PRODUCT_EDITOR_TEST_ID).waitFor();
  const hidden = page.getByRole('radio', { name: t('catalog.status-hidden') });
  await hidden.waitFor();
  if ((await hidden.getAttribute('aria-checked')) !== 'true')
    fail(`product-edit-settings-${tag}: Hidden is not selected`);
  const soldOut = page.getByRole('switch', { name: t('catalog.editor-sold-out') });
  if ((await soldOut.getAttribute('aria-checked')) !== 'true') fail(`product-edit-settings-${tag}: sold out is off`);
  await shoot(page, `product-edit-settings-${tag}`, lang);
}

async function shootSettings(page, tag, lang) {
  await open(page, '/settings');
  for (const id of [BUSINESS_LOGO_TEST_ID, STORE_LOGO_TEST_ID]) {
    const logo = byTestId(page, id);
    await logo.waitFor();
    const loaded = await logo.evaluate(
      (img) => img instanceof window.HTMLImageElement && img.decode().then(() => true),
    );
    if (!loaded) fail(`settings-profile-${tag}: ${id} is not a loaded image`);
  }
  await byTestId(page, STORE_SHOW_ADDRESS_TEST_ID).waitFor();
  await byTestId(page, soldOutOptionTestId('keep')).waitFor();
  await byTestId(page, soldOutOptionTestId('hide')).waitFor();
  await shoot(page, `settings-profile-${tag}`, lang);
}

async function shootCreateStoreTimeout(page, tag, lang) {
  // The server is answered by a stub with a store whose channel never reaches the session; nothing is created.
  await page.route('**/admin-api**', async (route) => {
    if (!CREATE_STORE_OPERATION.test(route.request().postData() ?? '')) return route.fallback();
    return route.fulfill({ json: { data: { createStore: { id: 'T_0', channelToken: NEVER_LISTED_TOKEN } } } });
  });
  try {
    await open(page, '/home');
    await byTestId(page, STORE_SWITCHER_TEST_ID).click();
    await byTestId(page, STORE_CREATE_TEST_ID).click();
    const dialog = byTestId(page, CREATE_STORE_DIALOG_TEST_ID);
    await dialog
      .getByRole('textbox')
      .nth(0)
      .fill(lang === 'ar' ? 'متجر الأدلة' : 'Evidence store');
    await dialog.getByRole('textbox').nth(1).fill(`evtimeout${lang}${tag.length}`);
    await page.waitForFunction(
      (selector) => document.querySelector(selector)?.disabled === false,
      `[data-testid="${CREATE_STORE_DIALOG_TEST_ID}"] button[type="submit"]`,
    );
    await dialog.locator('button[type="submit"]').click();
    await byTestId(page, CREATE_STORE_RECHECK_TEST_ID).waitFor({ timeout: CREATE_STORE_WAIT_MS });
    if ((await dialog.locator('button[type="submit"]').count()) !== 0)
      fail(`create-store-timeout-${tag}: Create is offered`);
    await shoot(page, `create-store-timeout-${tag}`, lang, { overlay: true });
  } finally {
    await page.unroute('**/admin-api**');
  }
}

async function shootAll(browser, lang, vp) {
  const t = T[lang];
  const tag = `${lang}-${vp}`;
  const page = await signedIn(browser, lang, vp);
  try {
    await shootList(page, t, tag, lang);
    await shootEditor(page, t, tag, lang);
    await shootSettings(page, tag, lang);
    await shootCreateStoreTimeout(page, tag, lang);
  } finally {
    await page.context().close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of LANGS) {
      for (const vp of Object.keys(VIEWPORTS)) await shootAll(browser, lang, vp);
    }
    proved('Every shot: dir matches the display language and there is no horizontal overflow.');
    proved(
      "Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.",
    );
    proved('The product list shows the seeded products and Create product; the Draft tab shows drafts only.');
    proved('The sold-out tab shows Stop orders / Resume orders and exactly one product, marked sold out.');
    proved('The editor of the Color x Size product shows four variant rows.');
    proved('The editor of the hidden product has Hidden selected and "Mark as sold out" on.');
    proved('The media picker lists library images; an SVG upload shows the media-type refusal.');
    proved('General settings shows the business and store logos as loaded images, the address switch and Keep/Hide.');
    proved('After the wait for a new store runs out, the dialog offers Check again and no second Create.');
  } finally {
    await browser.close();
  }
}

await main();
