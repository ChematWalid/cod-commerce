// Screenshot helper of scripts/evidence/P0.S2b-4.sh (CLAUDE.md §3a.14): drives the live dashboard of the
// cod-evidence stack with the Task 14 browser helpers and writes the 8 PNGs plus the README.
//
//   node scripts/evidence/dashboard-screens.mjs <dashboard-url> <out-dir>
//
// Env: SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD (read by the session helper), IMAGE_COMMIT (the commit the image was built from), REGEN_COMMAND.
// Node 24 strips the types of the imported .ts/.mts files; nothing here needs a build step.
/* global process, console, URL, fetch, document, getComputedStyle -- Node globals, and browser globals inside page.evaluate callbacks */
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARABIC_FONT_FAMILY,
  SHELL_PLACEHOLDER_PATH,
  SHELL_PLACEHOLDER_TEST_ID,
} from '../../plugins/merchant-shell/dashboard/constants.ts';
import { loginAsSuperadmin, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, outDir] = process.argv.slice(2);
if (!baseArg || !outDir) throw new Error('usage: dashboard-screens.mjs <dashboard-url> <out-dir>');
const base = baseArg.replace(/\/$/, '');
const MAX_BYTES = 300 * 1024;
const LOGIN_PATH = '/login';
/** The dashboard's own sign-out: the mutation its "Log out" menu item sends, on the Admin API. */
const ADMIN_API_PATH = '/admin-api';
const LOGOUT_MUTATION = 'mutation { logout { success } }';
const PHONE_MAX_WIDTH = 768;
/** The session this run documents; P0.S2c-polish.sh sets it, P0.S2b-4.sh keeps the default. */
const SESSION_ID = process.env.SESSION_ID ?? 'P0.S2b-4';
/** Per viewport and language: login and shell; the phone adds the opened sidebar. */
const EXPECTED_PNGS = 12;
/** The dashboard's sidebar toggle and its phone drawer. */
const SIDEBAR_TRIGGER = '[data-sidebar="trigger"]';
const SIDEBAR_DRAWER = '[data-sidebar="sidebar"][data-mobile="true"]';

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

/** The dashboard's user menu sits in the collapsed sidebar on a phone, so the Task 14 sign-in and language
 * helpers run in a desktop-sized context; its storage state (session cookies and the persisted display
 * language) then opens the shot context at the target viewport. */
async function prepareStorageState(browser, lang) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop.options, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await loginAsSuperadmin(page, base);
    await setDisplayLanguage(page, lang);
    return await context.storageState();
  } finally {
    await context.close();
  }
}

/** Fails unless the document says the expected direction and language (and, for Arabic, loaded the font). */
function assertDocument(state, lang, label) {
  if (state.dir !== LANG_DIRS[lang]) fail(`${label}: dir ${state.dir}, expected ${LANG_DIRS[lang]}`);
  if (state.lang !== lang) fail(`${label}: lang ${state.lang}, expected ${lang}`);
}

function assertArabicFont(state, label) {
  if (state.arabicFacesLoaded < 1 || state.arabicFacesMatched < 1) fail(`${label}: ${ARABIC_FONT_FAMILY} not loaded`);
  if (!state.bodyFontFamily.includes(ARABIC_FONT_FAMILY)) fail(`${label}: body font ${state.bodyFontFamily}`);
}

async function shootShell(page, lang, vpName) {
  const label = `shell ${lang}/${vpName}`;
  await page.goto(`${base}${SHELL_PLACEHOLDER_PATH}`);
  await page.getByTestId(SHELL_PLACEHOLDER_TEST_ID).waitFor({ state: 'attached' });
  await settle(page);
  const state = await documentState(page);
  assertDocument(state, lang, label);
  if (lang === 'ar') assertArabicFont(state, label);
  return capture(page, join(outDir, `merchant-shell-${lang}-${vpName}.png`));
}

/** Opens the phone sidebar over the shell page and captures it, then closes it again. */
async function shootMobileSidebar(page, lang) {
  await page.locator(SIDEBAR_TRIGGER).first().click();
  const drawer = page.locator(SIDEBAR_DRAWER);
  await drawer.waitFor({ state: 'visible' });
  await settle(page);
  await capture(page, join(outDir, `merchant-shell-sidebar-${lang}-mobile.png`));
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
}

/** Signs out with the dashboard's own `logout` mutation. Dropping cookies alone is not enough: the dashboard
 * also keeps a session token in localStorage and would stay signed in. The display language stays in
 * localStorage, which is how the login page opens in it (3.8.1 has no language picker there). */
async function signOut(page, label) {
  const loggedOut = await page.evaluate(
    async ([path, query]) => {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      return (await response.json()).data?.logout?.success === true;
    },
    [ADMIN_API_PATH, LOGOUT_MUTATION],
  );
  if (!loggedOut) fail(`${label}: sign-out failed`);
  await page.context().clearCookies();
}

async function shootLogin(page, lang, vpName) {
  const label = `login ${lang}/${vpName}`;
  await signOut(page, label);
  await page.goto(`${base}${LOGIN_PATH}`);
  await page.getByRole('textbox').first().waitFor();
  await settle(page);
  assertDocument(await documentState(page), lang, label);
  return capture(page, join(outDir, `login-${lang}-${vpName}.png`));
}

/** The shell and login shots of one viewport and language, from one prepared session. */
async function shootPair(browser, vpName, lang, deviceScaleFactor) {
  console.error(`context ${vpName}/${lang} (scale ${deviceScaleFactor})`);
  const storageState = await prepareStorageState(browser, lang);
  const options = { ...VIEWPORTS[vpName].options, deviceScaleFactor, storageState, reducedMotion: 'reduce' };
  const context = await browser.newContext(options);
  try {
    const page = await context.newPage();
    await shootShell(page, lang, vpName);
    if (vpName === 'mobile') await shootMobileSidebar(page, lang);
    await shootLogin(page, lang, vpName);
    return deviceScaleFactor;
  } finally {
    await context.close();
  }
}

async function shootPairWithinBudget(browser, vpName, lang) {
  const scale = VIEWPORTS[vpName].options.deviceScaleFactor;
  try {
    return { vpName, lang, scale: await shootPair(browser, vpName, lang, scale) };
  } catch (error) {
    if (!(error instanceof ScaleBudgetError) || scale === 1) throw error;
    return { vpName, lang, scale: await shootPair(browser, vpName, lang, 1) };
  }
}

async function shootAll() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const rows = [];
    for (const vpName of Object.keys(VIEWPORTS)) {
      for (const lang of Object.keys(LANG_DIRS)) rows.push(await shootPairWithinBudget(browser, vpName, lang));
    }
    return rows;
  } finally {
    await browser.close();
  }
}

function checkOutputs() {
  const files = readdirSync(outDir)
    .filter((f) => f.endsWith('.png'))
    .sort();
  if (files.length !== EXPECTED_PNGS) fail(`expected ${EXPECTED_PNGS} PNGs, found ${files.length}`);
  for (const f of files) {
    const size = statSync(join(outDir, f)).size;
    if (size > MAX_BYTES) fail(`${f} is ${size} bytes, over ${MAX_BYTES}`);
    console.log(`${f}\t${size}`);
  }
}

function viewportText(row) {
  return VIEWPORTS[row.vpName].label.replace(/, scale 1$/, '') + `, scale ${row.scale}`;
}

function tableRows(rows) {
  const lines = [];
  for (const r of rows) {
    const asserted = `\`${LANG_DIRS[r.lang]}\` / \`${r.lang}\``;
    const vp = viewportText(r);
    const login = `login-${r.lang}-${r.vpName}.png`;
    const shell = `merchant-shell-${r.lang}-${r.vpName}.png`;
    lines.push(`| [\`${login}\`](screens/${login}) | \`/dashboard${LOGIN_PATH}\` | ${vp} | ${r.lang} | ${asserted} |`);
    lines.push(
      `| [\`${shell}\`](screens/${shell}) | \`/dashboard${SHELL_PLACEHOLDER_PATH}\` | ${vp} | ${r.lang} | ${asserted} |`,
    );
    if (r.vpName === 'mobile') {
      const sidebar = `merchant-shell-sidebar-${r.lang}-mobile.png`;
      lines.push(
        `| [\`${sidebar}\`](screens/${sidebar}) | \`/dashboard${SHELL_PLACEHOLDER_PATH}\` (sidebar open) | ${vp} | ${r.lang} | ${asserted} |`,
      );
    }
  }
  return lines.join('\n');
}

/** Everything in the README is derived from this run; the text carries no date, size or font-face count,
 * so the output is deterministic and a re-run on the same tree rewrites it unchanged. */
function readmeText(rows) {
  const commit = process.env.IMAGE_COMMIT || fail('IMAGE_COMMIT is not set');
  return `# Evidence for ${SESSION_ID} (dashboard with RTL)

Screenshots of the real merchant dashboard (\`@vendure/dashboard\` 3.8.1 with the \`plugins/merchant-shell\` extension,
ADR 0010) served by a live run of the compose stack (CLAUDE.md §3a.14). Produced by
\`scripts/evidence/${SESSION_ID}.sh\`; nothing here is hand-written. Data is synthetic (placeholders from \`.env.example\`).

- Image: \`cod-platform:local\`, built by that run (\`docker compose build migrate\`) from a working tree with no uncommitted
  change outside the evidence folders, whose last image-relevant commit is \`${commit}\`.
- Base URL: \`${base}\` (compose project \`cod-evidence\`, host port 23100).
- Viewport screenshots (not full page), \`reducedMotion: reduce\`, taken after \`networkidle\` and \`document.fonts.ready\`.

| File | URL | Viewport | Language | \`dir\` / \`lang\` asserted |
| --- | --- | --- | --- | --- |
${tableRows(rows)}

## Checks (the script fails otherwise)

- Every page, login and shell: \`document.documentElement.dir\` is \`rtl\` for Arabic and \`ltr\` for English, and \`lang\` is \`ar\` / \`en\`.
- Shell pages: the \`${SHELL_PLACEHOLDER_TEST_ID}\` marker is present.
- Arabic shell pages: the \`${ARABIC_FONT_FAMILY}\` FontFace is \`loaded\`, and the body font family contains it.
- Every PNG is at most 300 KB (the ${EXPECTED_PNGS} files must all exist); no password or cookie secret appears in this folder.

## How the language is chosen

- **Dashboard pages:** the user menu → Language dialog (the helpers \`loginAsSuperadmin\` and \`setDisplayLanguage\` of
  \`apps/server/tests/browser/dashboard-session.ts\`). The choice is stored on the server and in the browser's
  \`localStorage\` key \`vendure-user-settings\`.
- **Login page:** 3.8.1 has no language picker on the login page and the page does not follow the browser locale. It reads the
  display language persisted in \`localStorage\` by an earlier in-app switch. The script therefore signs in, switches the language,
  shoots the shell page, signs out (the dashboard's \`logout\` mutation) and opens \`/dashboard${LOGIN_PATH}\`, which then renders in the
  persisted language. For a first-time visitor (empty \`localStorage\`) the login page is always English.

## Notes

- **Mobile sessions:** on a phone-width viewport the user menu is inside the collapsed sidebar, so the sign-in and the language
  switch run in a desktop-sized context. Its storage state (session cookies and \`localStorage\`) opens the 390x844 context that
  takes the shots; the mobile pages are loaded in the language chosen there.
- **Untranslated string:** the \`Administration\` sidebar label stays English in the Arabic shots. It is a literal in
  \`@vendure/dashboard\` 3.8.1 with no translation wrapper, so a plugin catalogue cannot reach it.
- **Footer:** \`Vendure v3.8.1\` stays on the login page: its source marks it as a licensing requirement, and the user
  decided to keep it until counsel answers (ADR 0001 section 8).

## Re-run

\`\`\`bash
cp .env.example .env   # once; the script needs the root .env
${process.env.REGEN_COMMAND ?? `scripts/evidence/${SESSION_ID}.sh`}
\`\`\`

It uses its own compose project (\`cod-evidence\`, host ports shifted by 20000), always rebuilds the image first (the layer
cache keeps that cheap), refuses to run on a working tree with uncommitted changes outside the evidence folders, and removes the
stack and its volumes on exit.
`;
}

const rows = await shootAll();
checkOutputs();
writeFileSync(join(outDir, '..', 'README.md'), readmeText(rows));
