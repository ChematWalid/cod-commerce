// Browser part of scripts/evidence/P2.S2.sh: the product type choice, the pack block, the product list's action menu, bulk
// edit (form and dry-run result), the export dialog and an export job in progress, and the import wizard (upload, a refused
// analysis, columns, preview, result), for {desktop 1280, mobile 390} x {ar, en}, on the Arabic demo store. Copied from
// P2.S1-screens.mjs.
//
//   node P2.S2-screens.mjs <dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_PACK_PRODUCT_ID (the saved two-component pack),
// EV_UPDATE_SKU (a product SKU of the store the import updates).
/* global process, console, URL, document, window, NodeFilter, Buffer, getComputedStyle, requestAnimationFrame */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EDITOR_TYPE_TEST_ID,
  PRODUCT_EDITOR_TEST_ID,
  PRODUCT_LIST_TEST_ID,
  PRODUCT_ROW_TEST_ID,
  PRODUCT_SEARCH_TEST_ID,
} from '../../plugins/catalog/dashboard/constants.ts';
import {
  BULK_DIALOG_TEST_ID,
  BULK_EDIT_ACTION_TEST_ID,
  BULK_RESULT_TEST_ID,
  BULK_STATUS_TEST_ID,
  BULK_SUBMIT_TEST_ID,
  CATALOG_IMPORT_PAGE_TEST_ID,
  EXPORT_ACTION_TEST_ID,
  EXPORT_DIALOG_TEST_ID,
  EXPORT_DOWNLOAD_TEST_ID,
  EXPORT_SUBMIT_TEST_ID,
  IMPORT_ACTION_TEST_ID,
  IMPORT_CONFIRM_TEST_ID,
  IMPORT_FILE_INPUT_TEST_ID,
  IMPORT_MAPPING_NEXT_TEST_ID,
  IMPORT_PREVIEW_NEXT_TEST_ID,
  IMPORT_RESULT_TEST_ID,
  IMPORT_SUMMARY_TEST_ID,
  IMPORT_UPLOAD_TEST_ID,
} from '../../plugins/catalog-import/dashboard/constants.ts';
import {
  PACK_BLOCK_TEST_ID,
  PACK_COMPONENT_ROW_TEST_ID,
  PACK_PRICE_TEST_ID,
} from '../../plugins/catalog-packs/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const PACK_ID = process.env.EV_PACK_PRODUCT_ID;
const UPDATE_SKU = process.env.EV_UPDATE_SKU;
if (!PACK_ID || !UPDATE_SKU) throw new Error('EV_PACK_PRODUCT_ID and EV_UPDATE_SKU must be set');

const MAX_BYTES = 300 * 1024;
/** The tallest shot; the editor's whole form fits in it. */
const MAX_SHOT_HEIGHT = 6000;
const STEP_TIMEOUT_MS = 30_000;
/** An import of a few rows runs in a job; the result is read again every second (JOB_POLL_INTERVAL_MS). */
const IMPORT_RESULT_TIMEOUT_MS = 90_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const STORE = '/stores/active';
const BULK_SEARCH = 'EVBULK';
const TICKED = 2;
/** The three products the API part created with SKUs EVBULK-1…3. */
const BULK_PRODUCTS = 3;
const PACK_COMPONENTS = 2;
/** Vendure's trigger of the action bar's dropdown menu. */
const ACTION_MENU_TEST_ID = 'action-bar-dropdown-trigger';
const EXPORT_JOB_OPERATION = /query CatalogExportJob\b/;
const LICENCE_NOTICE = '[data-vendure-branding]';
/** The framework's name; only the licence notice may show it on a merchant's screen (ADR 0007, D79). */
const VENDOR_NAME = /vendure/i;
/** A catalogue id shown as text means a missing translation. */
const RAW_MESSAGE_ID = /\b(catalog|catalog-import|packs|shell|subdomain)\.[a-z]+(-[a-z]+)+\b/;
/** A one-pixel PNG: what a merchant gets by renaming a photo `.csv`. */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108020000009077053e0000000c4944415408d763f8ffff3f0005fe02fea7d6a4b30000000049454e44ae426082',
  'hex',
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
const T = {
  ar: { catalog: catalogue('catalog', 'ar'), imp: catalogue('catalog-import', 'ar') },
  en: { catalog: catalogue('catalog', 'en'), imp: catalogue('catalog-import', 'en') },
};
const proved = (line) => console.error(line);
const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);

/**
 * The CSV the wizard imports: one row to create, one update of a product of the store, one pack row (refused in v1) and
 * a column the import does not know. SKUs carry the run's tag, so each of the four runs creates its own product.
 */
function wizardCsv(tag) {
  const sku = `EVSCR-${tag}`;
  return Buffer.from(
    [
      'product_key,name,type,status,price,variant_sku,Remarque libre',
      `${sku},منتج من الملف ${tag},physical,active,2500,${sku},قطن`,
      `${UPDATE_SKU},منتج للتحديث,physical,active,1300,${UPDATE_SKU},`,
      `${sku}-PACK,حزمة من الملف,pack,active,3000,${sku}-PACK,`,
      '',
    ].join('\r\n'),
    'utf8',
  );
}

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

/** `overlay`: a dialog or menu is the subject, so the shot is the viewport, without the page grown behind it. */
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

async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}

async function shootEditor(page, t, tag, lang) {
  await open(page, `${STORE}/products/new`);
  await byTestId(page, PRODUCT_EDITOR_TEST_ID).waitFor();
  await byTestId(page, EDITOR_TYPE_TEST_ID).click();
  const listbox = page.getByRole('listbox');
  await listbox.getByRole('option', { name: t.catalog('catalog.type-physical'), exact: true }).waitFor();
  await listbox.getByRole('option', { name: t.catalog('catalog.type-pack'), exact: true }).waitFor();
  await shoot(page, `product-create-type-${tag}`, lang, { overlay: true });
  await page.keyboard.press('Escape');

  await open(page, `${STORE}/products/${PACK_ID}`);
  await byTestId(page, PACK_BLOCK_TEST_ID).waitFor();
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${PACK_COMPONENT_ROW_TEST_ID}"]`, PACK_COMPONENTS],
  );
  await byTestId(page, PACK_PRICE_TEST_ID).waitFor();
  await shoot(page, `pack-form-${tag}`, lang);
}

async function openActionMenu(page) {
  await byTestId(page, ACTION_MENU_TEST_ID).click();
  await byTestId(page, EXPORT_ACTION_TEST_ID).waitFor();
}

async function shootListActions(page, t, tag, lang) {
  await open(page, `${STORE}/products`);
  await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
  await byTestId(page, PRODUCT_SEARCH_TEST_ID).fill(BULK_SEARCH);
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${PRODUCT_ROW_TEST_ID}"]`, BULK_PRODUCTS],
  );
  for (let index = 0; index < TICKED; index += 1)
    await byTestId(page, PRODUCT_ROW_TEST_ID).nth(index).getByRole('checkbox').click();
  await openActionMenu(page);
  await byTestId(page, IMPORT_ACTION_TEST_ID).waitFor();
  await byTestId(page, BULK_EDIT_ACTION_TEST_ID).waitFor();
  if ((await byTestId(page, BULK_EDIT_ACTION_TEST_ID).getAttribute('data-disabled')) !== null)
    fail(`product-list-actions-${tag}: Bulk edit is disabled with two products ticked`);
  await shoot(page, `product-list-actions-${tag}`, lang, { overlay: true });

  await byTestId(page, BULK_EDIT_ACTION_TEST_ID).click();
  const dialog = byTestId(page, BULK_DIALOG_TEST_ID);
  await dialog.waitFor();
  await byTestId(page, BULK_STATUS_TEST_ID).click();
  await page.getByRole('option', { name: t.imp('catalog-import.status-draft'), exact: true }).click();
  await dialog.getByLabel(t.imp('catalog-import.field-price'), { exact: true }).click();
  await page.getByRole('option', { name: t.imp('catalog-import.price-percent'), exact: true }).click();
  await dialog.getByLabel(t.imp('catalog-import.price-value'), { exact: true }).fill('10');
  await shoot(page, `bulk-edit-${tag}`, lang, { overlay: true });

  await byTestId(page, BULK_SUBMIT_TEST_ID).click();
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.getAttribute('data-phase') === 'reviewed',
    `[data-testid="${BULK_RESULT_TEST_ID}"]`,
  );
  await shoot(page, `bulk-edit-result-${tag}`, lang, { overlay: true });
  await closeDialog(page);

  await openActionMenu(page);
  await byTestId(page, EXPORT_ACTION_TEST_ID).click();
  const exportDialog = byTestId(page, EXPORT_DIALOG_TEST_ID);
  await exportDialog.waitFor();
  await exportDialog.getByLabel(t.imp('catalog-import.export-format'), { exact: true }).click();
  await page.getByRole('option', { name: t.imp('catalog-import.format-csv'), exact: true }).click();
  await byTestId(page, EXPORT_SUBMIT_TEST_ID).waitFor();
  await shoot(page, `export-dialog-${tag}`, lang, { overlay: true });
  await closeDialog(page);
}

async function shootExportJob(page, tag, lang) {
  // The worker could finish before the shot: the dashboard's reads of the job wait until the shot is taken.
  let release = () => {};
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/admin-api**', async (route) => {
    if (!EXPORT_JOB_OPERATION.test(route.request().postData() ?? '')) return route.fallback();
    await held;
    return route.continue();
  });
  try {
    await open(page, `${STORE}/products`);
    await byTestId(page, PRODUCT_ROW_TEST_ID).first().waitFor();
    await openActionMenu(page);
    await byTestId(page, EXPORT_ACTION_TEST_ID).click();
    const dialog = byTestId(page, EXPORT_DIALOG_TEST_ID);
    await dialog.waitFor();
    await byTestId(page, EXPORT_SUBMIT_TEST_ID).click();
    await dialog.getByRole('progressbar').waitFor();
    if ((await byTestId(page, EXPORT_DOWNLOAD_TEST_ID).count()) !== 0) fail(`export-job-${tag}: already downloadable`);
    await shoot(page, `export-job-${tag}`, lang, { overlay: true });
    release();
    await byTestId(page, EXPORT_DOWNLOAD_TEST_ID).waitFor({ timeout: IMPORT_RESULT_TIMEOUT_MS });
    await closeDialog(page);
  } finally {
    release();
    await page.unroute('**/admin-api**');
  }
}

async function openImport(page) {
  await open(page, `${STORE}/products/import`);
  await byTestId(page, CATALOG_IMPORT_PAGE_TEST_ID).waitFor();
}

async function shootImport(page, t, tag, lang) {
  await openImport(page);
  await byTestId(page, IMPORT_FILE_INPUT_TEST_ID).setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: wizardCsv(tag),
  });
  await page.waitForFunction(
    (selector) => document.querySelector(selector)?.disabled === false,
    `[data-testid="${IMPORT_UPLOAD_TEST_ID}"]`,
  );
  await shoot(page, `import-upload-${tag}`, lang);

  await openImport(page);
  await byTestId(page, IMPORT_FILE_INPUT_TEST_ID).setInputFiles({
    name: 'photo.csv',
    mimeType: 'text/csv',
    buffer: PNG,
  });
  await byTestId(page, IMPORT_UPLOAD_TEST_ID).click();
  await page.getByText(t.imp('catalog-import.file-type')).first().waitFor();
  await shoot(page, `import-analyze-${tag}`, lang);

  await openImport(page);
  await byTestId(page, IMPORT_FILE_INPUT_TEST_ID).setInputFiles({
    name: 'products.csv',
    mimeType: 'text/csv',
    buffer: wizardCsv(tag),
  });
  await byTestId(page, IMPORT_UPLOAD_TEST_ID).click();
  await byTestId(page, IMPORT_MAPPING_NEXT_TEST_ID).waitFor();
  await page.getByText('Remarque libre').first().waitFor();
  await shoot(page, `import-mapping-${tag}`, lang);

  await byTestId(page, IMPORT_MAPPING_NEXT_TEST_ID).click();
  await byTestId(page, IMPORT_PREVIEW_NEXT_TEST_ID).waitFor();
  await byTestId(page, IMPORT_SUMMARY_TEST_ID).waitFor();
  await page.getByText(t.imp('catalog-import.row-type-unsupported')).first().waitFor();
  await shoot(page, `import-preview-${tag}`, lang);

  await byTestId(page, IMPORT_PREVIEW_NEXT_TEST_ID).click();
  await byTestId(page, IMPORT_CONFIRM_TEST_ID).click();
  await byTestId(page, IMPORT_RESULT_TEST_ID).waitFor({ timeout: IMPORT_RESULT_TIMEOUT_MS });
  await page.getByRole('button', { name: t.imp('catalog-import.error-report') }).waitFor();
  await shoot(page, `import-confirm-${tag}`, lang);
}

async function shootAll(browser, lang, vp) {
  const t = T[lang];
  const tag = `${lang}-${vp}`;
  const page = await signedIn(browser, lang, vp);
  try {
    await shootEditor(page, t, tag, lang);
    await shootListActions(page, t, tag, lang);
    await shootExportJob(page, tag, lang);
    await shootImport(page, t, tag, lang);
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
    proved('The new product editor offers Physical product and Pack as its product type.');
    proved('The pack editor block of the saved pack shows two component rows and its price.');
    proved('With two products ticked the action menu offers Import, Export and an enabled Bulk edit.');
    proved('The bulk edit dry run answers a per-product result (phase "reviewed") and writes nothing.');
    proved('The export dialog offers its scope and format; a filtered export above 500 products shows its progress.');
    proved('The import wizard refuses a PNG named .csv with the file-type message after the upload.');
    proved(
      'The wizard maps the columns (the unknown one shown), previews the pack row as unsupported, and after Confirm shows the result with an error report.',
    );
  } finally {
    await browser.close();
  }
}

await main();
