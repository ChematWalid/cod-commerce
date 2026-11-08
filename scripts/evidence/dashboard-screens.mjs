// Screenshot helper of scripts/evidence/P0.S2b-4.sh (CLAUDE.md §3a.14): drives the live dashboard of the
// cod-evidence stack with the Task 14 browser helpers and writes the 8 PNGs plus the README.
//
//   node scripts/evidence/dashboard-screens.mjs <dashboard-url> <out-dir>
//
// Env: SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD (read by the session helper), IMAGE_ID, GIT_COMMIT, REGEN_COMMAND.
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
const LANGS = { ar: { dir: 'rtl' }, en: { dir: 'ltr' } };

const fail = (message) => {
  throw new Error(message);
};

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

/** Takes a viewport PNG; a mobile one falls back from scale 2 to 1 when it exceeds the budget. */
async function capture(page, file) {
  await page.screenshot({ path: file });
  if (statSync(file).size > MAX_BYTES && page.viewportSize().width < 768) {
    fail(`${file} is ${statSync(file).size} bytes at scale 2`);
  }
  return statSync(file).size;
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const rows = [];
try {
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    for (const [lang, { dir }] of Object.entries(LANGS)) {
      let options = vp.options;
      for (let attempt = 0; ; attempt += 1) {
        // The dashboard's user menu sits in the sidebar, which is collapsed on a phone, so the sign-in and the
        // language switch (the Task 14 helpers) run in a desktop-sized context; its storage state (session
        // cookies and the persisted display language) then opens the shot context at the target viewport.
        const prep = await browser.newContext({ ...VIEWPORTS.desktop.options, reducedMotion: 'reduce' });
        const prepPage = await prep.newPage();
        let storageState;
        try {
          console.error(`context ${vpName}/${lang}`);
          await loginAsSuperadmin(prepPage, base);
          await setDisplayLanguage(prepPage, lang);
          storageState = await prep.storageState();
        } finally {
          await prep.close();
        }
        const context = await browser.newContext({ ...options, storageState, reducedMotion: 'reduce' });
        const page = await context.newPage();
        try {
          // Authenticated shell page, in the language chosen in the app.
          await page.goto(`${base}${SHELL_PLACEHOLDER_PATH}`);
          await page.getByTestId(SHELL_PLACEHOLDER_TEST_ID).waitFor({ state: 'attached' });
          await settle(page);
          const shell = await documentState(page);
          if (shell.dir !== dir) fail(`shell ${lang}/${vpName}: dir ${shell.dir}, expected ${dir}`);
          if (shell.lang !== lang) fail(`shell ${lang}/${vpName}: lang ${shell.lang}, expected ${lang}`);
          if (lang === 'ar') {
            if (shell.arabicFacesLoaded < 1 || shell.arabicFacesMatched < 1)
              fail(`shell ar/${vpName}: ${ARABIC_FONT_FAMILY} not loaded`);
            if (!shell.bodyFontFamily.includes(ARABIC_FONT_FAMILY))
              fail(`shell ar/${vpName}: body font ${shell.bodyFontFamily}`);
          }
          const shellFile = join(outDir, `merchant-shell-${lang}-${vpName}.png`);
          const shellSize = await capture(page, shellFile);

          // Login page: the real mechanism is the display language the browser persisted (localStorage
          // `vendure-user-settings`) after the in-app switch above. Signing out with the dashboard's own
          // `logout` mutation (the one its "Log out" menu item sends) ends the session and keeps that setting,
          // so the login page opens in the chosen language. Dropping cookies alone is not enough: the
          // dashboard also keeps a session token in localStorage and would stay signed in.
          const loggedOut = await page.evaluate(async () => {
            const response = await fetch('/admin-api', {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ query: 'mutation { logout { success } }' }),
            });
            return (await response.json()).data?.logout?.success === true;
          });
          if (!loggedOut) fail(`sign-out failed for ${lang}/${vpName}`);
          await context.clearCookies();
          await page.goto(`${base}/login`);
          await page.getByRole('textbox').first().waitFor();
          await settle(page);
          const login = await documentState(page);
          const loginFile = join(outDir, `login-${lang}-${vpName}.png`);
          const loginSize = await capture(page, loginFile);
          rows.push({ vpName, lang, dir, scale: options.deviceScaleFactor, shell, shellSize, login, loginSize });
          break;
        } catch (error) {
          if (attempt === 0 && options.deviceScaleFactor === 2 && /bytes at scale 2/.test(String(error))) {
            options = { ...options, deviceScaleFactor: 1 };
            continue;
          }
          throw error;
        } finally {
          await context.close();
        }
      }
    }
  }
} finally {
  await browser.close();
}

const files = readdirSync(outDir)
  .filter((f) => f.endsWith('.png'))
  .sort();
if (files.length !== 8) fail(`expected 8 PNGs, found ${files.length}`);
for (const f of files) {
  const size = statSync(join(outDir, f)).size;
  if (size > MAX_BYTES) fail(`${f} is ${size} bytes, over ${MAX_BYTES}`);
  console.log(`${f}\t${size}`);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const order = ['desktop', 'mobile'].flatMap((v) =>
  ['ar', 'en'].map((l) => rows.find((r) => r.vpName === v && r.lang === l)),
);
const tableRows = [];
for (const r of order) {
  const vp = VIEWPORTS[r.vpName].label.replace(/, scale 1$/, '') + (r.scale === 2 ? ', scale 2' : '');
  tableRows.push(
    `| [\`login-${r.lang}-${r.vpName}.png\`](screens/login-${r.lang}-${r.vpName}.png) | \`/dashboard/login\` | ${vp} | ${r.lang} | \`${r.login.dir}\` / \`${r.login.lang}\` | ${kb(r.loginSize)} |`,
  );
  tableRows.push(
    `| [\`merchant-shell-${r.lang}-${r.vpName}.png\`](screens/merchant-shell-${r.lang}-${r.vpName}.png) | \`/dashboard${SHELL_PLACEHOLDER_PATH}\` | ${vp} | ${r.lang} | \`${r.shell.dir}\` / \`${r.shell.lang}\` | ${kb(r.shellSize)} |`,
  );
}
const arShell = order.filter((r) => r.lang === 'ar').map((r) => r.shell);
const readme = `# Evidence for P0.S2b-4 (dashboard with RTL)

Screenshots of the real merchant dashboard (\`@vendure/dashboard\` 3.8.1 with the \`plugins/merchant-shell\` extension,
ADR 0010) served by a live run of the compose stack (CLAUDE.md §3a.14). Generated on ${new Date().toISOString().slice(0, 10)} by
\`scripts/evidence/P0.S2b-4.sh\`; nothing here is hand-written. Data is synthetic (placeholders from \`.env.example\`).

- Image: \`${process.env.IMAGE_ID ?? 'unknown'}\` (\`cod-platform:local\`), built from commit \`${process.env.GIT_COMMIT ?? 'unknown'}\`.
- Base URL: \`${base}\` (compose project \`cod-evidence\`, host port 23100).
- Viewport screenshots (not full page), \`reducedMotion: reduce\`, taken after \`networkidle\` and \`document.fonts.ready\`.

| File | URL | Viewport | Language | \`dir\` / \`lang\` observed | Size |
| --- | --- | --- | --- | --- | --- |
${tableRows.join('\n')}

## Shell page checks (asserted before each shot, the script fails otherwise)

- \`document.documentElement.dir\` is \`rtl\` for Arabic and \`ltr\` for English; \`lang\` is \`ar\` / \`en\`.
- The \`${SHELL_PLACEHOLDER_TEST_ID}\` marker is present.
- Arabic: the \`${ARABIC_FONT_FAMILY}\` FontFace is \`loaded\` (${arShell.map((s) => `${s.arabicFacesLoaded} loaded face(s)`).join(', ')}), and the body font family contains it.

## How the language is chosen

- **Dashboard pages:** the user menu → Language dialog (the helpers \`loginAsSuperadmin\` and \`setDisplayLanguage\` of
  \`apps/server/tests/browser/dashboard-session.ts\`). The choice is stored on the server and in the browser's
  \`localStorage\` key \`vendure-user-settings\`.
- **Login page:** 3.8.1 has no language picker on the login page and the page does not follow the browser locale. It reads the
  display language persisted in \`localStorage\` by an earlier in-app switch. The script therefore signs in, switches the language,
  shoots the shell page, signs out (the dashboard's \`logout\` mutation) and opens \`/dashboard/login\`, which then renders in the persisted
  language. For a first-time visitor (empty \`localStorage\`) the login page is always English.
- The login page \`dir\`/\`lang\` columns are recorded as observed, not asserted.

## Re-run

\`\`\`bash
cp .env.example .env   # once; the script needs the root .env
${process.env.REGEN_COMMAND ?? 'scripts/evidence/P0.S2b-4.sh'}
\`\`\`

It uses its own compose project (\`cod-evidence\`, host ports shifted by 20000), reuses the \`\${APP_IMAGE:-cod-platform:local}\`
image (building it only when absent), and removes the stack and its volumes on exit. It fails if a PNG is over 300 KB, if the
superadmin password or the cookie secret appears in the output folder, or if any assertion above does not hold.
`;
writeFileSync(join(outDir, '..', 'README.md'), readme);
