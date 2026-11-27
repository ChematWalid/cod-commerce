// Browser part of scripts/evidence/P3.S1.sh: the Delivery Pricing list, the new pricing option form (its top, then its
// wilaya table), the saved option with Alger's override, the saved option with Alger expanded to its communes, and the
// store settings card with its Default pricing option field, and part 2's tools (the Raise/lower by dialog over three
// ticked wilayas, Set price for all communes in an expanded wilaya, the Copy dialog of the list, the Import CSV dialog
// with its dry-run preview), for {desktop 1280, mobile 390} x {ar, en}, on the Arabic demo store. Copied from P2.S5-screens.mjs (the same checks on every shot).
//
//   node P3.S1-screens.mjs <dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_GROUP_ID (the pricing option the API part
// created, edited and linked as the store default), EV_GROUP_NAME (its name), EV_IMPORT_CSV (the CSV file the import
// dialog chooses: that option's export with three rows changed).
/* global process, console, URL, document, window, NodeFilter, getComputedStyle, requestAnimationFrame */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADJUST_DIALOG_TEST_ID,
  ADJUST_OPEN_TEST_ID,
  ADJUST_VALUE_TEST_ID,
  COMMUNE_PANEL_TEST_ID,
  COMMUNE_PRICES_TEST_ID,
  COMMUNE_ROW_TEST_ID,
  COPY_DIALOG_TEST_ID,
  CSV_IMPORT_DIALOG_TEST_ID,
  CSV_IMPORT_FILE_TEST_ID,
  CSV_IMPORT_OPEN_TEST_ID,
  CSV_PREVIEW_TEST_ID,
  DELIVERY_PATH,
  NEW_PRICING_PATH,
  PRICING_EDITOR_TEST_ID,
  PRICING_LIST_TEST_ID,
  PRICING_ROW_TEST_ID,
  pricingPathOf,
  SELECT_ALL_TEST_ID,
  WILAYA_ROW_TEST_ID,
  WILAYA_SELECT_TEST_ID,
} from '../../plugins/delivery-pricing/dashboard/constants.ts';
import {
  SETTINGS_PATH,
  STORE_CARD_TEST_ID,
  STORE_FEE_GROUP_TEST_ID,
} from '../../plugins/merchant-shell/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const env = (name) => process.env[name] ?? fail(`${name} must be set`);
const GROUP_ID = env('EV_GROUP_ID');
const GROUP_NAME = env('EV_GROUP_NAME');
const IMPORT_CSV = env('EV_IMPORT_CSV');

const MAX_BYTES = 300 * 1024;
/** The tallest shot; a list or a settings card fits in it. */
const MAX_SHOT_HEIGHT = 6000;
const STEP_TIMEOUT_MS = 30_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const STORE_PAGES = '/stores/active/';
/** Every wilaya of the 2026 law (D3123): the form lists each. */
const WILAYA_COUNT = 69;
/** The demo store's pricing options after the API part: its platform table, the evidence option and its copy. */
const LISTED_GROUPS = 3;
/** The wilayas ticked for "Raise/lower by…", the first three rows; the amount typed into its dialog. */
const TICKED_WILAYAS = ['01', '02', '03'];
const ADJUST_AMOUNT = '100';
/** What "Set price for all communes" shows typed in (never applied). */
const COMMUNE_HOME_PRICE = '500';
const COMMUNE_DESK_PRICE = '300';
const ALGER = '16';
const LICENCE_NOTICE = '[data-vendure-branding]';
/** The framework's name; only the licence notice may show it on a merchant's screen (ADR 0007, D79). */
const VENDOR_NAME = /vendure/i;
/** A catalogue id shown as text means a missing translation. */
const RAW_MESSAGE_ID = /\b(delivery-pricing|shell|settings)\.[a-z]+(-[a-z]+)+\b/;

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
const T = { ar: catalogue('delivery-pricing', 'ar'), en: catalogue('delivery-pricing', 'en') };
const proved = (line) => console.error(line);
const byTestId = (page, id) => page.locator(`[data-testid="${id}"]`);
const wilayaRow = (page, code) => page.locator(`[data-testid="${WILAYA_ROW_TEST_ID}"][data-province-code="${code}"]`);

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
 * grown to the content's height (capped), and `work` runs while it is.
 */
async function withWholeContent(page, work) {
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
  try {
    await work();
  } finally {
    await page.setViewportSize(viewport);
  }
}

/** The box around the cards holding each test id (the element itself when it sits in no card). */
const regionOf = (page, testIds) =>
  page.evaluate((ids) => {
    const boxes = ids.map((id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);
      if (element === null) throw new Error(`no ${id}`);
      return (element.closest('[data-slot="card"]') ?? element).getBoundingClientRect();
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const margin = 8;
    return {
      x: Math.max(0, Math.floor(left - margin)),
      y: Math.max(0, Math.floor(top - margin)),
      width: Math.ceil(right - left + 2 * margin),
      height: Math.ceil(bottom - top + 2 * margin),
    };
  }, testIds);

/**
 * The widest spill, in pixels, of an element out of the dashboard card holding it (left or right), with its card's
 * title: a card clips what sticks out, so a spill is content the merchant cannot read. Elements inside their own
 * scroller or clipping box, and zero-width or one-pixel helpers (screen-reader text), are left out.
 */
const cardSpill = (page) =>
  page.evaluate(() => {
    let worst = { px: 0, card: '' };
    for (const card of document.querySelectorAll('[data-slot="card"]')) {
      const box = card.getBoundingClientRect();
      if (box.width === 0) continue;
      for (const element of card.querySelectorAll('*')) {
        const own = element.getBoundingClientRect();
        if (own.width <= 1) continue;
        let clipper = element.parentElement;
        while (clipper !== card && getComputedStyle(clipper).overflowX === 'visible') clipper = clipper.parentElement;
        if (clipper !== card) continue;
        const px = Math.max(box.left - own.left, own.right - box.right);
        if (px > worst.px) worst = { px, card: (card.textContent ?? '').trim().slice(0, 40) };
      }
    }
    return worst;
  });

/**
 * `viewport`: the subject is what the screen shows at its current scroll (the form's top, a row scrolled into view),
 * since the 69-row form grown whole would pass the size limit. `region`: test ids whose cards are the subject.
 */
async function shoot(page, name, lang, { viewport = false, region = null } = {}) {
  await settle(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  const spill = await cardSpill(page);
  if (spill.px > 1) fail(`${name}: ${Math.ceil(spill.px)}px stick out of the card "${spill.card}"`);
  const text = await textOutsideNotice(page);
  if (VENDOR_NAME.test(text)) fail(`${name}: the framework's name is visible`);
  const raw = RAW_MESSAGE_ID.exec(text);
  if (raw !== null) fail(`${name}: the untranslated id ${raw[0]} is visible`);
  const file = join(outDir, `${name}.png`);
  if (viewport) await page.screenshot({ path: file });
  else if (region !== null)
    await withWholeContent(page, async () => page.screenshot({ path: file, clip: await regionOf(page, region) }));
  else await withWholeContent(page, () => page.screenshot({ path: file }));
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

/** Scrolls `locator` to the top of its scroller, so a viewport shot shows it and what follows. */
const toTop = (locator) => locator.evaluate((element) => element.scrollIntoView({ block: 'start' }));

async function shootList(page, tag, lang) {
  await open(page, `${DELIVERY_PATH}?tab=pricing`);
  await byTestId(page, PRICING_LIST_TEST_ID).waitFor();
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length >= count,
    [`[data-testid="${PRICING_ROW_TEST_ID}"]`, LISTED_GROUPS],
  );
  await byTestId(page, PRICING_LIST_TEST_ID).getByText(GROUP_NAME).first().waitFor();
  await shoot(page, `pricing-list-${tag}`, lang);
}

async function waitForForm(page) {
  await byTestId(page, PRICING_EDITOR_TEST_ID).waitFor();
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${WILAYA_ROW_TEST_ID}"]`, WILAYA_COUNT],
  );
}

async function shootNewForm(page, tag, lang) {
  await open(page, `${STORE_PAGES}${NEW_PRICING_PATH}`);
  await waitForForm(page);
  await shoot(page, `new-pricing-top-${tag}`, lang, { viewport: true });
  await toTop(byTestId(page, WILAYA_ROW_TEST_ID).first());
  await shoot(page, `new-pricing-table-${tag}`, lang, { viewport: true });
}

async function shootSaved(page, t, tag, lang) {
  await open(page, `${STORE_PAGES}${pricingPathOf(GROUP_ID)}`);
  await waitForForm(page);
  const alger = wilayaRow(page, ALGER);
  await alger.getByText(t('delivery-pricing.overridden'), { exact: true }).waitFor();
  await toTop(alger);
  await shoot(page, `edit-override-${tag}`, lang, { viewport: true });

  await alger.getByRole('button', { name: t('delivery-pricing.communes'), exact: true }).click();
  const panel = byTestId(page, COMMUNE_PANEL_TEST_ID);
  await panel.waitFor();
  await page.waitForFunction(
    (selector) => document.querySelectorAll(selector).length > 3,
    `[data-testid="${COMMUNE_ROW_TEST_ID}"]`,
  );
  await toTop(alger);
  await shoot(page, `edit-communes-${tag}`, lang, { viewport: true });

  const prices = byTestId(page, COMMUNE_PRICES_TEST_ID);
  await prices.locator('input').nth(0).fill(COMMUNE_HOME_PRICE);
  await prices.locator('input').nth(1).fill(COMMUNE_DESK_PRICE);
  await toTop(prices);
  await shoot(page, `bulk-commune-prices-${tag}`, lang, { viewport: true });
}

async function shootAdjust(page, tag, lang) {
  await open(page, `${STORE_PAGES}${pricingPathOf(GROUP_ID)}`);
  await waitForForm(page);
  for (const code of TICKED_WILAYAS)
    await wilayaRow(page, code).locator(`[data-testid="${WILAYA_SELECT_TEST_ID}"]`).click();
  await byTestId(page, ADJUST_OPEN_TEST_ID).click();
  await byTestId(page, ADJUST_DIALOG_TEST_ID).waitFor();
  await byTestId(page, ADJUST_VALUE_TEST_ID).fill(ADJUST_AMOUNT);
  await toTop(byTestId(page, SELECT_ALL_TEST_ID));
  await shoot(page, `bulk-adjust-dialog-${tag}`, lang, { viewport: true });
}

async function shootCopy(page, t, tag, lang) {
  await open(page, `${DELIVERY_PATH}?tab=pricing`);
  await byTestId(page, PRICING_LIST_TEST_ID).waitFor();
  const row = page.locator(`[data-testid="${PRICING_ROW_TEST_ID}"]`, { hasText: GROUP_NAME });
  await row.getByRole('button', { name: t('delivery-pricing.row-actions'), exact: true }).click();
  await page.getByRole('menuitem', { name: t('delivery-pricing.action-copy'), exact: true }).click();
  await byTestId(page, COPY_DIALOG_TEST_ID).waitFor();
  await shoot(page, `copy-dialog-${tag}`, lang, { viewport: true });
}

async function shootCsvImport(page, tag, lang) {
  await open(page, `${STORE_PAGES}${pricingPathOf(GROUP_ID)}`);
  await waitForForm(page);
  await byTestId(page, CSV_IMPORT_OPEN_TEST_ID).click();
  await byTestId(page, CSV_IMPORT_DIALOG_TEST_ID).waitFor();
  await byTestId(page, CSV_IMPORT_FILE_TEST_ID).setInputFiles(IMPORT_CSV);
  await byTestId(page, CSV_PREVIEW_TEST_ID).waitFor();
  await shoot(page, `csv-import-preview-${tag}`, lang, { viewport: true });
}

async function shootSettings(page, tag, lang) {
  await open(page, SETTINGS_PATH);
  await byTestId(page, STORE_CARD_TEST_ID).waitFor();
  const field = byTestId(page, STORE_FEE_GROUP_TEST_ID);
  await page.waitForFunction(
    ([selector, name]) => document.querySelector(selector)?.textContent?.includes(name) === true,
    [`[data-testid="${STORE_FEE_GROUP_TEST_ID}"]`, GROUP_NAME],
  );
  await field.scrollIntoViewIfNeeded();
  await shoot(page, `store-settings-fee-group-${tag}`, lang, { region: [STORE_CARD_TEST_ID] });
}

async function shootAll(browser, lang, vp) {
  const t = T[lang];
  const tag = `${lang}-${vp}`;
  const page = await signedIn(browser, lang, vp);
  try {
    await shootList(page, tag, lang);
    await shootNewForm(page, tag, lang);
    await shootSaved(page, t, tag, lang);
    await shootAdjust(page, tag, lang);
    await shootCopy(page, t, tag, lang);
    await shootCsvImport(page, tag, lang);
    await shootSettings(page, tag, lang);
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
    proved(
      'Every shot: dir matches the display language, there is no horizontal overflow and nothing sticks out of a card.',
    );
    proved(
      "Every shot: the framework's name appears only inside the licence notice, and no raw message id is visible.",
    );
    proved(`The Delivery pricing tab lists at least ${LISTED_GROUPS} pricing options, the evidence option among them.`);
    proved(`The new pricing option form lists all ${WILAYA_COUNT} wilayas.`);
    proved("The saved option's Alger row shows the Edited mark of its override.");
    proved("Alger's Communes button opens its commune panel with its communes listed.");
    proved('The Raise/lower by dialog opens over three ticked wilayas, with its amount typed.');
    proved('Set price for all communes shows in an expanded wilaya, filled in and not applied.');
    proved("The list row's Copy action opens the Copy dialog, and the Import CSV dialog shows its dry-run preview.");
    proved("The store settings card's Default pricing option field names the evidence option.");
  } finally {
    await browser.close();
  }
}

await main();
