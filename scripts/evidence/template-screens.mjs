// Screenshot helper of scripts/evidence/P1.S1.sh (CLAUDE.md §3a.14): drives the live dashboard of the cod-evidence
// stack, signed in as a business owner (the merchant's real role), to the notes page and writes the PNGs
// (ar/en x desktop/mobile), the content-language shot and the README table rows.
//
//   node scripts/evidence/template-screens.mjs <dashboard-url> <out-dir> <table-file>
//
// Env: SUPERADMIN_USERNAME, DEMO_OWNER_PASSWORD (read by the session helpers), OWNER_EMAIL_A / OWNER_EMAIL_B (the
// owners of the two businesses), CHANNEL_CODE_A / CHANNEL_TOKEN_A (A's Arabic store), NOTE_TITLES (A's titles that
// must be on the page, separated by "|"), OTHER_BUSINESS_TITLE (B's note: never on A's shots, and on B's page once B's
// owner signs in). Node 24 strips the types of the imported .ts files; nothing here needs a build step.
/* global process, console, URL, document, localStorage, getComputedStyle -- Node globals, and browser globals inside page.evaluate callbacks */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARABIC_FONT_FAMILY } from '../../plugins/merchant-shell/dashboard/constants.ts';
import { TEMPLATE_NOTES_PATH, TEMPLATE_NOTES_TEST_ID } from '../../plugins/_template/dashboard/constants.ts';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir, tableFile] = process.argv.slice(2);
if (!baseArg || !outDir || !tableFile)
  throw new Error('usage: template-screens.mjs <dashboard-url> <out-dir> <table-file>');
const base = baseArg.replace(/\/$/, '');
const {
  CHANNEL_CODE_A,
  CHANNEL_TOKEN_A: channelToken,
  OWNER_EMAIL_A,
  OWNER_EMAIL_B,
  OTHER_BUSINESS_TITLE: otherBusinessTitle,
} = process.env;
const noteTitles = (process.env.NOTE_TITLES ?? '').split('|').filter(Boolean);
if (!channelToken || !CHANNEL_CODE_A || !OWNER_EMAIL_A || !OWNER_EMAIL_B || !otherBusinessTitle || !noteTitles.length) {
  throw new Error('CHANNEL_CODE_A, CHANNEL_TOKEN_A, OWNER_EMAIL_A, OWNER_EMAIL_B, OTHER_BUSINESS_TITLE and NOTE_TITLES must be set');
}
const MAX_BYTES = 300 * 1024;
const PHONE_MAX_WIDTH = 768;
/** The dashboard's localStorage key of the selected channel token (`@vendure/dashboard` storage-keys.ts). */
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';

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

/** Selects a business in the dashboard's channel switcher (the first button of the sidebar, a menu of channel
 * codes) as a merchant would, and fails unless the dashboard persisted its token: writing \`localStorage\` alone
 * is overwritten by the dashboard's own channel state. */
async function selectChannel(page, code, token) {
  await page.locator('[data-sidebar="sidebar"] button').first().click();
  await page.getByRole('menuitem', { name: code, exact: true }).click();
  await page.waitForFunction(([key, value]) => localStorage.getItem(key) === value, [SELECTED_CHANNEL_KEY, token]);
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

/** The dashboard's user menu sits in the collapsed sidebar on a phone, so the sign-in and language helpers run
 * in a desktop-sized context; its storage state (session, display language and the selected channel) then
 * opens the shot context at the target viewport. Business A is selected the way the channel switcher does it:
 * through the switcher, so the page's queries carry A's `vendure-token`. */
async function prepareStorageState(browser, lang) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop.options, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await loginAsOwner(page, base, OWNER_EMAIL_A);
    await setDisplayLanguage(page, lang);
    await selectChannel(page, CHANNEL_CODE_A, channelToken);
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

async function shootWithinBudget(browser, vpName, lang) {
  const scale = VIEWPORTS[vpName].options.deviceScaleFactor;
  try {
    return { vpName, lang, scale: await shootNotes(browser, vpName, lang, scale) };
  } catch (error) {
    if (!(error instanceof ScaleBudgetError) || scale === 1) throw error;
    return { vpName, lang, scale: await shootNotes(browser, vpName, lang, 1) };
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const rows = [];
try {
  await assertOtherOwnerSeesOwnNotes(browser);
  for (const vpName of Object.keys(VIEWPORTS)) {
    for (const lang of Object.keys(LANG_DIRS)) rows.push(await shootWithinBudget(browser, vpName, lang));
  }
} finally {
  await browser.close();
}

const files = readdirSync(outDir)
  .filter((f) => f.endsWith('.png'))
  .sort();
if (files.length !== 4) fail(`expected 4 PNGs, found ${files.length}`);
for (const f of files) {
  const size = statSync(join(outDir, f)).size;
  if (size > MAX_BYTES) fail(`${f} is ${size} bytes, over ${MAX_BYTES}`);
  console.log(`${f}\t${size}`);
}

const vpText = (row) => VIEWPORTS[row.vpName].label.replace(/, scale 1$/, '') + `, scale ${row.scale}`;
writeFileSync(
  tableFile,
  rows
    .map((r) => {
      const file = `template-notes-${r.lang}-${r.vpName}.png`;
      return `| [\`${file}\`](screens/${file}) | \`/dashboard${TEMPLATE_NOTES_PATH}\` | ${vpText(r)} | ${r.lang} | \`${LANG_DIRS[r.lang]}\` / \`${r.lang}\` |`;
    })
    .join('\n') + '\n',
);
