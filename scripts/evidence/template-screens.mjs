// Screenshot helper of scripts/evidence/P1.S1.sh (CLAUDE.md §3a.14): drives the live dashboard of the cod-evidence
// stack, signed in as a business owner (the merchant's real role), to the notes page and writes the PNGs
// (ar/en x desktop/mobile), the content-language shots (desktop/mobile) and the README table rows.
//
//   node scripts/evidence/template-screens.mjs <dashboard-url> <out-dir> <table-file>
//
// Env: SUPERADMIN_USERNAME, DEMO_OWNER_PASSWORD (read by the session helpers), OWNER_EMAIL_A / OWNER_EMAIL_B (the
// owners of the two businesses), STORE_SUBDOMAIN_A / CHANNEL_TOKEN_A (A's Arabic store), NOTE_TITLES (A's titles that
// must be on the page, separated by "|"), OTHER_BUSINESS_TITLE (B's note: never on A's shots, and on B's page once B's
// owner signs in). Node 24 strips the types of the imported .ts files; nothing here needs a build step.
/* global process, console, URL, document, localStorage, getComputedStyle -- Node globals, and browser globals inside page.evaluate callbacks */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARABIC_FONT_FAMILY, STORE_SWITCHER_TEST_ID } from '../../plugins/merchant-shell/dashboard/constants.ts';
import { TEMPLATE_NOTES_PATH, TEMPLATE_NOTES_TEST_ID } from '../../plugins/_template/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir, tableFile] = process.argv.slice(2);
if (!baseArg || !outDir || !tableFile)
  throw new Error('usage: template-screens.mjs <dashboard-url> <out-dir> <table-file>');
const base = baseArg.replace(/\/$/, '');
const {
  STORE_SUBDOMAIN_A: storeSubdomain,
  CHANNEL_TOKEN_A: channelToken,
  OWNER_EMAIL_A,
  OWNER_EMAIL_B,
  OTHER_BUSINESS_TITLE: otherBusinessTitle,
} = process.env;
const noteTitles = (process.env.NOTE_TITLES ?? '').split('|').filter(Boolean);
if (!channelToken || !storeSubdomain || !OWNER_EMAIL_A || !OWNER_EMAIL_B || !otherBusinessTitle || !noteTitles.length) {
  throw new Error(
    'STORE_SUBDOMAIN_A, CHANNEL_TOKEN_A, OWNER_EMAIL_A, OWNER_EMAIL_B, OTHER_BUSINESS_TITLE and NOTE_TITLES must be set',
  );
}
// A subdomain is lowercase letters, digits and hyphens, so it goes into the exact-match pattern below unescaped.
if (!/^[a-z0-9-]+$/.test(storeSubdomain)) throw new Error(`STORE_SUBDOMAIN_A is not a subdomain: ${storeSubdomain}`);
/** Arabic store A's content language (D7: a store offers exactly its own language). */
const STORE_LANGUAGE_A = 'ar';
const MAX_BYTES = 300 * 1024;
const PHONE_MAX_WIDTH = 768;
/** The dashboard's localStorage key of the selected channel token (`@vendure/dashboard` storage-keys.ts). */
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
/** The dashboard's localStorage key of the user settings, the content language among them. */
const USER_SETTINGS_KEY = 'vendure-user-settings';

/** A phone screenshot went over the size budget at its device scale; the caller retries at scale 1. */
class ScaleBudgetError extends Error {}

const VIEWPORTS = {
  desktop: {
    label: 'desktop 1280x800, scale 1',
    options: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  },
  mobile: {
    label: 'mobile 390x844, touch',
    options: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  },
};
const LANG_DIRS = { ar: 'rtl', en: 'ltr' };

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

async function documentState(page) {
  return page.evaluate(async (family) => {
    await document.fonts.ready;
    const matched = await document.fonts.load(`16px "${family}"`, 'ع');
    const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === family);
    return {
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      arabicFacesMatched: matched.length,
      arabicFacesLoaded: faces.filter((face) => face.status === 'loaded').length,
    };
  }, ARABIC_FONT_FAMILY);
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }',
  });
}

/** Takes a viewport PNG; a phone one over budget raises ScaleBudgetError so the caller can drop to scale 1. */
async function capture(page, file) {
  await page.screenshot({ path: file });
  const size = statSync(file).size;
  if (size <= MAX_BYTES) return size;
  if (page.viewportSize().width < PHONE_MAX_WIDTH) throw new ScaleBudgetError(`${file} is ${size} bytes`);
  return fail(`${file} is ${size} bytes, over ${MAX_BYTES}`);
}

// The merchant store switcher in the top bar (D79), mirrored from apps/server/tests/browser/store-switcher-fixtures.ts,
// which a node script cannot import (it needs vitest and the @cod packages at runtime).
const switcher = (page) => page.locator(`[data-testid="${STORE_SWITCHER_TEST_ID}"]`);
/** The active store's subdomain on the switcher's button; present once the stores loaded and one is active. */
const switcherSubdomain = (page) => switcher(page).locator('bdi[dir="ltr"]');
/** The menu entry whose subdomain line is exactly this subdomain, whatever the store's name. */
const storeItem = (page, subdomain) =>
  page.getByRole('menuitem').filter({ has: page.locator('bdi[dir="ltr"]', { hasText: new RegExp(`^${subdomain}$`) }) });

async function waitForSwitcherOn(page, subdomain) {
  await page.waitForFunction(
    ([selector, expected]) => document.querySelector(selector)?.textContent?.trim() === expected,
    [`[data-testid="${STORE_SWITCHER_TEST_ID}"] bdi[dir="ltr"]`, subdomain],
  );
}

/** Waits until the dashboard's user settings carry this content language and their save went out (D7). */
async function waitForContentLanguage(page, language) {
  await page.waitForFunction(
    ([key, expected]) => JSON.parse(localStorage.getItem(key) ?? '{}').contentLanguage === expected,
    [USER_SETTINGS_KEY, language],
  );
  await page.waitForLoadState('networkidle');
}

/** Selects a store in the merchant store switcher as a merchant would, and fails unless the dashboard persisted
 * its channel token, shows it on the switcher and moved the content language to the store's (D7). It first waits
 * for the switcher to show an active store, so the session's own move to the first store cannot land after the
 * choice. Writing \`localStorage\` alone is overwritten by the dashboard's own channel state. */
async function selectStore(page, { subdomain, token, language }) {
  await switcherSubdomain(page).waitFor({ state: 'visible', timeout: 30_000 });
  await switcher(page).click();
  await storeItem(page, subdomain).click();
  await page.waitForFunction(([key, value]) => localStorage.getItem(key) === value, [SELECTED_CHANNEL_KEY, token]);
  await waitForSwitcherOn(page, subdomain);
  await waitForContentLanguage(page, language);
}

/** The other business's owner sees that business's note and none of A's: the page is scoped by who signs in. */
async function assertOtherOwnerSeesOwnNotes(browser) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop.options, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await loginAsOwner(page, base, OWNER_EMAIL_B);
    await setDisplayLanguage(page, 'en');
    await page.goto(`${base}${TEMPLATE_NOTES_PATH}`);
    const marker = page.getByTestId(TEMPLATE_NOTES_TEST_ID);
    await marker.getByText(otherBusinessTitle, { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 });
    for (const title of noteTitles) {
      if ((await marker.getByText(title, { exact: false }).count()) > 0) fail(`B's owner sees A's note "${title}"`);
    }
    console.error("isolation: B's owner lists B's note and none of A's");
  } finally {
    await context.close();
  }
}

/** The sign-in and language helpers are proven at a desktop size, so they run in a desktop-sized context; its
 * storage state (session, display language, the selected channel and the content language) then opens the shot
 * context at the target viewport. Store A is selected the way a merchant does it, through the store switcher in
 * the top bar (D79), so the page's queries carry A's `vendure-token`. */
async function prepareStorageState(browser, lang) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop.options, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await loginAsOwner(page, base, OWNER_EMAIL_A);
    await setDisplayLanguage(page, lang);
    await selectStore(page, { subdomain: storeSubdomain, token: channelToken, language: STORE_LANGUAGE_A });
    return await context.storageState();
  } finally {
    await context.close();
  }
}

function assertDocument(state, lang, label) {
  if (state.dir !== LANG_DIRS[lang]) fail(`${label}: dir ${state.dir}, expected ${LANG_DIRS[lang]}`);
  if (state.lang !== lang) fail(`${label}: lang ${state.lang}, expected ${lang}`);
}

function assertArabicFont(state, label) {
  if (state.arabicFacesLoaded < 1 || state.arabicFacesMatched < 1) fail(`${label}: ${ARABIC_FONT_FAMILY} not loaded`);
  if (!state.bodyFontFamily.includes(ARABIC_FONT_FAMILY)) fail(`${label}: body font ${state.bodyFontFamily}`);
}

async function shootNotes(browser, vpName, lang, deviceScaleFactor) {
  const label = `template-notes ${lang}/${vpName}`;
  console.error(`context ${vpName}/${lang} (scale ${deviceScaleFactor})`);
  const storageState = await prepareStorageState(browser, lang);
  const options = { ...VIEWPORTS[vpName].options, deviceScaleFactor, storageState, reducedMotion: 'reduce' };
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    await page.goto(`${base}${TEMPLATE_NOTES_PATH}`);
    const marker = page.getByTestId(TEMPLATE_NOTES_TEST_ID);
    await marker.waitFor({ state: 'attached' });
    for (const title of noteTitles)
      await marker.getByText(title, { exact: false }).first().waitFor({ state: 'visible' });
    await settle(page);
    const state = await documentState(page);
    assertDocument(state, lang, label);
    if (lang === 'ar') assertArabicFont(state, label);
    if ((await marker.getByText(otherBusinessTitle, { exact: false }).count()) > 0)
      fail(`${label}: shows the other business's note`);
    const alert = await page.getByRole('alert').count();
    if (alert > 0) fail(`${label}: the page shows an alert instead of the notes`);
    await capture(page, join(outDir, `template-notes-${lang}-${vpName}.png`));
    return deviceScaleFactor;
  } finally {
    await context.close();
  }
}

/** Arabic store: the dashboard's content language must follow the store (D7). The merchant menu has no
 * content-language row, so D7 is asserted from the user settings; the shot shows the store switcher open, with
 * store A active and checked. */
async function shootContentLanguage(browser, vpName, deviceScaleFactor) {
  const label = `dashboard-content-language ar/${vpName}`;
  console.error(`context ${vpName}/content-language (scale ${deviceScaleFactor})`);
  const storageState = await prepareStorageState(browser, 'ar');
  const options = { ...VIEWPORTS[vpName].options, deviceScaleFactor, storageState, reducedMotion: 'reduce' };
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    await page.goto(`${base}${TEMPLATE_NOTES_PATH}`);
    await page.getByTestId(TEMPLATE_NOTES_TEST_ID).getByText(noteTitles[0], { exact: false }).first().waitFor();
    await waitForSwitcherOn(page, storeSubdomain);
    await settle(page);
    const state = await documentState(page);
    assertDocument(state, 'ar', label);
    assertArabicFont(state, label);
    const language = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}').contentLanguage,
      USER_SETTINGS_KEY,
    );
    if (language !== STORE_LANGUAGE_A) fail(`${label}: the Arabic store's content language is ${language}`);
    await switcher(page).click();
    await storeItem(page, storeSubdomain).waitFor({ state: 'visible' });
    await capture(page, join(outDir, `dashboard-content-language-ar-${vpName}.png`));
    return deviceScaleFactor;
  } finally {
    await context.close();
  }
}

/** Shoots at the viewport's scale, and once more at scale 1 when a phone shot is over the size budget. */
async function shootWithinBudget(vpName, shoot) {
  const scale = VIEWPORTS[vpName].options.deviceScaleFactor;
  try {
    return await shoot(scale);
  } catch (error) {
    if (!(error instanceof ScaleBudgetError) || scale === 1) throw error;
    return shoot(1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const notesRows = [];
const languageRows = [];
try {
  await assertOtherOwnerSeesOwnNotes(browser);
  for (const vpName of Object.keys(VIEWPORTS)) {
    for (const lang of Object.keys(LANG_DIRS)) {
      const scale = await shootWithinBudget(vpName, (s) => shootNotes(browser, vpName, lang, s));
      notesRows.push({ vpName, lang, scale });
    }
  }
  for (const vpName of Object.keys(VIEWPORTS)) {
    const scale = await shootWithinBudget(vpName, (s) => shootContentLanguage(browser, vpName, s));
    languageRows.push({ vpName, scale });
  }
} finally {
  await browser.close();
}

const files = readdirSync(outDir)
  .filter((f) => f.endsWith('.png'))
  .sort();
if (files.length !== 6) fail(`expected 6 PNGs, found ${files.length}`);
for (const f of files) {
  const size = statSync(join(outDir, f)).size;
  if (size > MAX_BYTES) fail(`${f} is ${size} bytes, over ${MAX_BYTES}`);
  console.log(`${f}\t${size}`);
}

const vpText = (row) => VIEWPORTS[row.vpName].label.replace(/, scale 1$/, '') + `, scale ${row.scale}`;
const notesRow = (r) => {
  const file = `template-notes-${r.lang}-${r.vpName}.png`;
  return `| [\`${file}\`](screens/${file}) | \`/dashboard${TEMPLATE_NOTES_PATH}\` | ${vpText(r)} | ${r.lang} | \`${LANG_DIRS[r.lang]}\` / \`${r.lang}\` |`;
};
const languageRow = (r) => {
  const file = `dashboard-content-language-ar-${r.vpName}.png`;
  const where = `\`/dashboard${TEMPLATE_NOTES_PATH}\`, store switcher open, store \`${storeSubdomain}\` active`;
  return `| [\`${file}\`](screens/${file}) | ${where} | ${vpText(r)} | ar | \`rtl\` / \`ar\`, content language \`${STORE_LANGUAGE_A}\` (D7) |`;
};
writeFileSync(tableFile, [...notesRows.map(notesRow), ...languageRows.map(languageRow)].join('\n') + '\n');
