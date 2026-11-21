// Browser part of scripts/evidence/P2.S5.sh: the offers list, the create dialog, the editor of each of the seven app types
// (the saved quantity, buy-x-get-y and add-on offers, the others new), the quantity editor's Arabic order-form preview and
// summary, the codes panel and the product editor's Offers block, for {desktop 1280, mobile 390} x {ar, en}, on the
// Arabic demo store.
//
//   node P2.S5-screens.mjs <dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_PRODUCT_ID (the 4,900 product),
// EV_QUANTITY_OFFER_ID, EV_BXGY_OFFER_ID, EV_ADDON_OFFER_ID, EV_CODES_OFFER_ID (offers the API part created).
/* global process, console, URL, document, window, NodeFilter, getComputedStyle, requestAnimationFrame */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_TYPE_CARD_TEST_ID,
  ARABIC_PREVIEW_TEST_ID,
  CODES_PANEL_TEST_ID,
  CREATE_DIALOG_TEST_ID,
  CREATE_OFFER_TEST_ID,
  OFFER_EDITOR_TEST_ID,
  OFFER_LIST_TEST_ID,
  OFFER_ROW_TEST_ID,
  PRODUCT_OFFER_ROW_TEST_ID,
  PRODUCT_OFFERS_TEST_ID,
  SUMMARY_CARD_TEST_ID,
} from '../../plugins/offers/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const env = (name) => process.env[name] ?? fail(`${name} must be set`);
const PRODUCT_ID = env('EV_PRODUCT_ID');
const SAVED = {
  quantity: env('EV_QUANTITY_OFFER_ID'),
  bxgy: env('EV_BXGY_OFFER_ID'),
  addon: env('EV_ADDON_OFFER_ID'),
};
const CODES_OFFER_ID = env('EV_CODES_OFFER_ID');

const MAX_BYTES = 300 * 1024;
/** The tallest shot; an editor's whole form fits in it. */
const MAX_SHOT_HEIGHT = 6000;
const STEP_TIMEOUT_MS = 30_000;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const OFFERS = '/stores/active/offers';
/** The seven built-in app types, in catalogue order (D2515). */
const APP_TYPE_IDS = [
  'quantity',
  'free_delivery',
  'product_discount',
  'discount_codes',
  'bxgy',
  'order_discount',
  'addon',
];
/** The offers of the Arabic demo store the API part leaves (one deleted draft aside). */
const LISTED_OFFERS = 7;
/** Offers bought on the 4,900 product: the quantity offer, its copy and the buy-x-get-y. */
const PRODUCT_OFFERS = 3;
/** The 4,900 product at the first tier's 10 % (D2409: per unit, half-up). */
const UNIT_AT_TEN_PERCENT = 4410;
const FIRST_CODE = 'WELCOME10';
const LICENCE_NOTICE = '[data-vendure-branding]';
/** The framework's name; only the licence notice may show it on a merchant's screen (ADR 0007, D79). */
const VENDOR_NAME = /vendure/i;
/** A catalogue id shown as text means a missing translation. */
const RAW_MESSAGE_ID = /\b(catalog|shell|subdomain|offers)\.[a-z]+(-[a-z]+)+\b/;

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
const T = { ar: catalogue('offers', 'ar'), en: catalogue('offers', 'en') };
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
 * `overlay`: a dialog is the subject, so the shot is the viewport, without the blurred page grown behind it.
 * `region`: test ids whose cards are the subject, so the shot is the box around them.
 */
async function shoot(page, name, lang, { overlay = false, region = null } = {}) {
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
  if (overlay) await page.screenshot({ path: file });
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

/** The dialog parts a merchant needs to read it and to leave it; seven cards outgrow a phone, so they must not scroll away. */
const DIALOG_PARTS = ['[data-slot="dialog-title"]', '[data-slot="dialog-close"]'];

/**
 * Fails unless the open dialog's title and close button lie wholly inside the viewport (before any scroll): a dialog
 * taller than the screen used to push both above its top edge on a phone, out of reach.
 */
async function assertDialogReachable(page, name) {
  const outside = await page.evaluate((selectors) => {
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    if (dialog === null) return ['the dialog'];
    return selectors.filter((selector) => {
      const part = dialog.querySelector(selector);
      if (part === null) return true;
      const box = part.getBoundingClientRect();
      return box.top < 0 || box.left < 0 || box.bottom > window.innerHeight || box.right > window.innerWidth;
    });
  }, DIALOG_PARTS);
  if (outside.length > 0) fail(`${name}: ${outside.join(' and ')} outside the viewport`);
}

const open = (page, path) => page.goto(`${base}${path}`, { waitUntil: 'domcontentloaded' });
const visibleCards = (page) => page.locator(`[data-testid="${APP_TYPE_CARD_TEST_ID}"]:visible`);
/** A whole amount as the Arabic preview writes it (ar-DZ, Latin digits), as the browser spec reads it. */
const previewAmount = (value) => new Intl.NumberFormat('ar-DZ', { numberingSystem: 'latn' }).format(value);

async function shootList(page, t, tag, lang) {
  await open(page, OFFERS);
  await byTestId(page, OFFER_LIST_TEST_ID).waitFor();
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length >= count,
    [`[data-testid="${OFFER_ROW_TEST_ID}"]`, LISTED_OFFERS],
  );
  await shoot(page, `offers-list-${tag}`, lang);

  await byTestId(page, CREATE_OFFER_TEST_ID).click();
  const dialog = byTestId(page, CREATE_DIALOG_TEST_ID);
  await dialog.waitFor();
  await dialog.getByRole('tab', { name: t('offers.create-all-kinds') }).click();
  await page.waitForFunction(
    ([selector, count]) =>
      [...document.querySelectorAll(selector)].filter((card) => card.checkVisibility()).length === count,
    [`[data-testid="${APP_TYPE_CARD_TEST_ID}"]`, APP_TYPE_IDS.length],
  );
  if ((await visibleCards(page).count()) !== APP_TYPE_IDS.length) fail(`create-dialog-${tag}: not seven cards`);
  await assertDialogReachable(page, `create-dialog-${tag}`);
  await shoot(page, `create-dialog-${tag}`, lang, { overlay: true });
}

async function openEditor(page, appTypeId) {
  const saved = SAVED[appTypeId];
  await open(page, saved === undefined ? `${OFFERS}/new?type=${appTypeId}` : `${OFFERS}/${saved}`);
  await byTestId(page, OFFER_EDITOR_TEST_ID).waitFor();
  await byTestId(page, ARABIC_PREVIEW_TEST_ID).waitFor();
  await byTestId(page, SUMMARY_CARD_TEST_ID).waitFor();
}

async function shootEditors(page, t, tag, lang) {
  for (const id of APP_TYPE_IDS) {
    await openEditor(page, id);
    if (SAVED[id] === undefined) await page.getByText(t('offers.editor-new-heading')).first().waitFor();
    await shoot(page, `editor-${id}-${tag}`, lang);
  }

  await openEditor(page, 'quantity');
  const unit = previewAmount(UNIT_AT_TEN_PERCENT);
  await page.waitForFunction(
    ([selector, text]) => document.querySelector(selector)?.textContent.includes(text) === true,
    [`[data-testid="${ARABIC_PREVIEW_TEST_ID}"]`, unit],
  );
  await shoot(page, `arabic-preview-${tag}`, lang, { region: [ARABIC_PREVIEW_TEST_ID, SUMMARY_CARD_TEST_ID] });
}

async function shootCodesAndBlock(page, tag, lang) {
  await open(page, `${OFFERS}/${CODES_OFFER_ID}`);
  const panel = byTestId(page, CODES_PANEL_TEST_ID);
  await panel.getByText(FIRST_CODE, { exact: true }).waitFor();
  await panel.getByText('SAME10', { exact: true }).waitFor();
  await shoot(page, `codes-panel-${tag}`, lang, { region: [CODES_PANEL_TEST_ID] });

  await open(page, `/stores/active/products/${PRODUCT_ID}`);
  await byTestId(page, PRODUCT_OFFERS_TEST_ID).waitFor();
  await page.waitForFunction(
    ([selector, count]) => document.querySelectorAll(selector).length === count,
    [`[data-testid="${PRODUCT_OFFER_ROW_TEST_ID}"]`, PRODUCT_OFFERS],
  );
  await byTestId(page, PRODUCT_OFFERS_TEST_ID).scrollIntoViewIfNeeded();
  await shoot(page, `product-offers-block-${tag}`, lang, { region: [PRODUCT_OFFERS_TEST_ID] });
}

async function shootAll(browser, lang, vp) {
  const t = T[lang];
  const tag = `${lang}-${vp}`;
  const page = await signedIn(browser, lang, vp);
  try {
    await shootList(page, t, tag, lang);
    await shootEditors(page, t, tag, lang);
    await shootCodesAndBlock(page, tag, lang);
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
    proved(`The offers list shows at least ${LISTED_OFFERS} offers of the store.`);
    proved('The create dialog, on All types, shows exactly seven app-type cards.');
    proved("The create dialog's title and close button lie inside the viewport, on desktop and on a phone.");
    proved('Each of the seven editors shows its form, the Arabic order-form preview and the summary.');
    proved(`The quantity editor's preview shows the first tier's unit price (${UNIT_AT_TEN_PERCENT} DZD).`);
    proved(`The codes panel lists ${FIRST_CODE} and SAME10.`);
    proved(`The product editor's Offers block lists the ${PRODUCT_OFFERS} offers bought on the 4,900 product.`);
  } finally {
    await browser.close();
  }
}

await main();
