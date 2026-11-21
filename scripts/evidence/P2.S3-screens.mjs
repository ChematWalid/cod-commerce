// Browser part of scripts/evidence/P2.S3.sh: the collections list (filled and empty), a new manual collection with three
// picked products, an automatic collection (All, then Any) with its live preview, the delete dialog, the collections
// block of the product editor and catalog's product list filtered by a collection, for {desktop 1280, mobile 390} x
// {ar, en}, on the Arabic demo store. Nothing is saved from the pages.
//
//   node P2.S3-screens.mjs <dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_DEMO_STORE_ID, EV_EMPTY_STORE_ID (the owner's
// second store, which holds no collection), EV_AUTO_ID (the All collection), EV_ALL_COUNT / EV_ANY_COUNT (the API's
// preview counts of its rule with All and Any), EV_DELETE_ID / EV_FILTER_TITLE (the manual collection), EV_BLOCK_PRODUCT_ID,
// EV_PICK_SEARCH / EV_PICK_TITLES (the Add products search and the three titles it picks, separated by "|").
/* global process, console, URL, document, window, NodeFilter, getComputedStyle, requestAnimationFrame */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCT_LIST_TEST_ID, PRODUCT_ROW_TEST_ID } from '../../plugins/catalog/dashboard/constants.ts';
import {
  ADD_PRODUCTS_TEST_ID,
  COLLECTION_EDITOR_TEST_ID,
  COLLECTION_LIST_TEST_ID,
  COLLECTION_MATCH_ANY_TEST_ID,
  COLLECTION_ROW_TEST_ID,
  COLLECTION_TITLE_TEST_ID,
  COLLECTIONS_EMPTY_TEST_ID,
  CONDITION_ROW_TEST_ID,
  CREATE_COLLECTION_TEST_ID,
  MANUAL_PRODUCT_ROW_TEST_ID,
  PREVIEW_COUNT_TEST_ID,
  PRODUCT_COLLECTIONS_BLOCK_TEST_ID,
} from '../../plugins/collections-rules/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const env = (name) => process.env[name] || fail(`${name} must be set`);
const DEMO_STORE = env('EV_DEMO_STORE_ID');
const EMPTY_STORE = env('EV_EMPTY_STORE_ID');
const AUTO_ID = env('EV_AUTO_ID');
const ALL_COUNT = env('EV_ALL_COUNT');
const ANY_COUNT = env('EV_ANY_COUNT');
const DELETE_ID = env('EV_DELETE_ID');
const FILTER_TITLE = env('EV_FILTER_TITLE');
const BLOCK_PRODUCT_ID = env('EV_BLOCK_PRODUCT_ID');
const PICK_SEARCH = env('EV_PICK_SEARCH');
const PICK_TITLES = env('EV_PICK_TITLES').split('|');

const MAX_BYTES = 300 * 1024;
/** The tallest shot; the editor's whole form fits in it. */
const MAX_SHOT_HEIGHT = 6000;
const STEP_TIMEOUT_MS = 30_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
/** Tag, Price and Color rows of the All collection. */
const AUTO_CONDITIONS = 3;
/** The products the manual collection of the filter holds. */
const FILTERED_PRODUCTS = 3;
const LICENCE_NOTICE = '[data-vendure-branding]';
/** The framework's name; only the licence notice may show it on a merchant's screen (ADR 0007, D79). */
const VENDOR_NAME = /vendure/i;
/** A catalogue id shown as text means a missing translation. */
const RAW_MESSAGE_ID = /\b(catalog|collections|shell|subdomain)\.[a-z]+(-[a-z_]+)+\b/;

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
const T = Object.fromEntries(
  LANGS.map((lang) => [lang, { col: catalogue('collections-rules', lang), cat: catalogue('catalog', lang) }]),
);
const proved = (line) => console.error(line);
const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);
const collectionRow = (page, id) =>
  page.locator(`[data-testid="${COLLECTION_ROW_TEST_ID}"][data-collection-id="${id}"]`);

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

/** The dashboard scrolls its content pane, not the document: the viewport grows to the content for the shot. */
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

/** `overlay`: a dialog is the subject, so the shot is the viewport, without the page grown behind it. */
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
const demoPath = (rest) => `/stores/${DEMO_STORE}/${rest}`;
const previewCount = (page) => byTestId(page, PREVIEW_COUNT_TEST_ID).getAttribute('data-count');

async function waitForPreview(page, count, name) {
  await page.waitForFunction(
    ([selector, wanted]) => document.querySelector(selector)?.dataset.count === wanted,
    [`[data-testid="${PREVIEW_COUNT_TEST_ID}"]`, count],
    { timeout: STEP_TIMEOUT_MS },
  );
  if ((await previewCount(page)) !== count) fail(`${name}: the preview does not count ${count}`);
}

async function shootList(page, t, tag, lang) {
  await open(page, demoPath('collections'));
  await byTestId(page, COLLECTION_LIST_TEST_ID).waitFor();
  await collectionRow(page, DELETE_ID).waitFor();
  await byTestId(page, CREATE_COLLECTION_TEST_ID).waitFor();
  await shoot(page, `collections-list-${tag}`, lang);

  await collectionRow(page, DELETE_ID)
    .getByRole('button', { name: t.col('collections.row-actions') })
    .click();
  await page.getByRole('menuitem', { name: t.col('collections.action-delete') }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByText(t.col('collections.delete-heading')).waitFor();
  if (!(await dialog.innerText()).includes(FILTER_TITLE)) fail(`collection-delete-dialog-${tag}: no collection name`);
  await shoot(page, `collection-delete-dialog-${tag}`, lang, { overlay: true });
  await dialog.getByRole('button', { name: t.col('collections.cancel') }).click();
  await dialog.waitFor({ state: 'detached' });
}

async function shootNewManual(page, t, tag, lang) {
  await open(page, demoPath('collections/new'));
  await byTestId(page, COLLECTION_EDITOR_TEST_ID).waitFor();
  await byTestId(page, COLLECTION_TITLE_TEST_ID).fill(lang === 'ar' ? 'مختارات الجري' : 'Running picks');
  await byTestId(page, ADD_PRODUCTS_TEST_ID).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(t.col('collections.search-products')).fill(PICK_SEARCH);
  for (const title of PICK_TITLES) await dialog.getByRole('checkbox', { name: title, exact: true }).click();
  const add = t.col('collections.add-picked').replace('{count}', String(PICK_TITLES.length));
  await dialog.getByRole('button', { name: add }).click();
  await dialog.waitFor({ state: 'detached' });
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${MANUAL_PRODUCT_ROW_TEST_ID}"]`, PICK_TITLES.length],
  );
  const shown = await byTestId(page, MANUAL_PRODUCT_ROW_TEST_ID).allInnerTexts();
  if (!PICK_TITLES.every((title, index) => shown[index]?.includes(title)))
    fail(`collection-new-manual-${tag}: the rows are not in the picked order`);
  await shoot(page, `collection-new-manual-${tag}`, lang);
}

async function shootAutomatic(page, tag, lang) {
  await open(page, demoPath(`collections/${AUTO_ID}`));
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${CONDITION_ROW_TEST_ID}"]`, AUTO_CONDITIONS],
  );
  await waitForPreview(page, ALL_COUNT, `collection-edit-automatic-${tag}`);
  await shoot(page, `collection-edit-automatic-${tag}`, lang);

  await byTestId(page, COLLECTION_MATCH_ANY_TEST_ID).click();
  await waitForPreview(page, ANY_COUNT, `collection-preview-any-${tag}`);
  await shoot(page, `collection-preview-any-${tag}`, lang);
}

async function shootProductBlock(page, tag, lang) {
  await open(page, demoPath(`products/${BLOCK_PRODUCT_ID}`));
  const block = byTestId(page, PRODUCT_COLLECTIONS_BLOCK_TEST_ID);
  await block.waitFor();
  await block.getByText(FILTER_TITLE).first().waitFor();
  await shoot(page, `product-editor-collections-${tag}`, lang);
}

async function shootFilter(page, t, tag, lang) {
  await open(page, demoPath('products'));
  const list = byTestId(page, PRODUCT_LIST_TEST_ID);
  await byTestId(page, PRODUCT_ROW_TEST_ID).nth(FILTERED_PRODUCTS).waitFor();
  await list.getByRole('combobox', { name: t.cat('catalog.filter-collection') }).click();
  await page.getByRole('option', { name: FILTER_TITLE }).click();
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${PRODUCT_ROW_TEST_ID}"]`, FILTERED_PRODUCTS],
  );
  await shoot(page, `product-list-collection-filter-${tag}`, lang);
}

/** Last: opening the second store's list switches the session to it. */
async function shootEmpty(page, tag, lang) {
  await open(page, `/stores/${EMPTY_STORE}/collections`);
  await byTestId(page, COLLECTIONS_EMPTY_TEST_ID).waitFor();
  if ((await byTestId(page, COLLECTION_ROW_TEST_ID).count()) !== 0) fail(`collections-empty-${tag}: rows are shown`);
  await shoot(page, `collections-empty-${tag}`, lang);
}

async function shootAll(browser, lang, vp) {
  const t = T[lang];
  const tag = `${lang}-${vp}`;
  const page = await signedIn(browser, lang, vp);
  try {
    await shootList(page, t, tag, lang);
    await shootNewManual(page, t, tag, lang);
    await shootAutomatic(page, tag, lang);
    await shootProductBlock(page, tag, lang);
    await shootFilter(page, t, tag, lang);
    await shootEmpty(page, tag, lang);
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
    proved('The collections list shows the manual collection and Create; its delete dialog names the collection.');
    proved('A new collection gets the three products picked through Add products, listed in the order picked.');
    proved(
      `The automatic collection shows its ${AUTO_CONDITIONS} condition rows and a preview count of ${ALL_COUNT} (All), the API's count.`,
    );
    proved(`Switched to Any without saving, the preview counts ${ANY_COUNT}, the API's count for Any.`);
    proved("The product editor's collections block lists the manual collection of the product.");
    proved(`Catalog's product list filtered by the manual collection shows exactly its ${FILTERED_PRODUCTS} products.`);
    proved("The owner's second store shows the empty collections list and no row.");
  } finally {
    await browser.close();
  }
}

await main();
