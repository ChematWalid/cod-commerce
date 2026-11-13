// Browser part of scripts/evidence/P1.S3.sh: the roles and activity screens, then what tests cannot show: a read-only member's
// page, a real refusal, the permissions-failed message, a selected-store member on another store, and a role change reaching a
// member whose requests go to a second api process. Every screen is shot in Arabic and English, desktop and mobile.
//
//   node P1.S3-screens.mjs <dashboard-url> <second-api-dashboard-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_OTHER_STORE_TOKEN (never printed), EV_RUN.
/* global process, console, URL, document, fetch, localStorage -- Node globals, and browser globals inside page.evaluate */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, secondArg, outDir] = process.argv.slice(2);
if (!baseArg || !secondArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const second = secondArg.replace(/\/$/, '');
const { EV_OTHER_STORE_TOKEN: OTHER_STORE_TOKEN, EV_RUN: RUN } = process.env;
if (!OTHER_STORE_TOKEN || !RUN) throw new Error('EV_OTHER_STORE_TOKEN and EV_RUN must be set');

const MAX_BYTES = 300 * 1024;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const LIMITED = 'limited@demo.example.test';
const ORDERS_MEMBER = 'orders@demo.example.test';
const LICENCE_FOOTER = '[data-vendure-branding]';
const CHANNEL_KEY = 'vendure-selected-channel-token';
const ROLES_LINK = 'a[href$="/team/roles"]';
const VIEWER_ROLE = 'Demo viewer';
const VIEW_PERMISSION = 'team.roles.view';

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

function catalogue(lang) {
  const entries = new Map();
  const po = readFileSync(join(root, `plugins/rbac/dashboard/i18n/${lang}.po`), 'utf8');
  for (const [, id, text] of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) entries.set(id, text);
  return (id) => entries.get(id) ?? fail(`${lang}.po has no ${id}`);
}
const T = { ar: catalogue('ar'), en: catalogue('en') };
const proved = (line) => console.error(line);

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }',
  });
}

async function shoot(page, name, lang) {
  await settle(page);
  const dir = await page.evaluate(() => document.documentElement.dir);
  if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  const clipped = await page.evaluate(() =>
    Math.max(0, ...[...document.querySelectorAll('table')].map((t) => t.scrollWidth - t.parentElement.clientWidth)),
  );
  if (clipped > 1) fail(`${name}: a table is ${clipped}px wider than its container`);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  console.error(`shot ${name}`);
}

async function signedIn(browser, { url = base, email, lang, vp = 'desktop' }) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  // The user menu lives in the sidebar, which a phone-width page hides: sign in wide, then narrow to the shot's size.
  await page.setViewportSize(VIEWPORTS.desktop.viewport);
  await loginAsOwner(page, url, email);
  await setDisplayLanguage(page, lang);
  await page.setViewportSize(VIEWPORTS[vp].viewport);
  return page;
}

/** The answer of the Admin API on the page's own session and origin; `token` overrides the selected store. */
function graphql(page, query, variables = {}, token) {
  return page.evaluate(
    async ([q, v, key, override]) => {
      const response = await fetch('/admin-api', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'vendure-token': override ?? localStorage.getItem(key) ?? '' },
        body: JSON.stringify({ query: q, variables: v }),
      });
      return response.json();
    },
    [query, variables, CHANNEL_KEY, token ?? null],
  );
}

const codeOf = (answer) => answer.errors?.[0]?.extensions?.code ?? null;

function roleRow(page, name) {
  return page.getByRole('row').filter({ hasText: name });
}

async function openRoles(page, t) {
  await page.goto(`${base}/team/roles`);
  await page.getByRole('button', { name: t('rbac.new-role'), exact: true }).waitFor();
  await page.getByRole('row').nth(1).waitFor();
}

async function shootActivity(page, lang, vp) {
  await page.goto(`${base}/team/activity-log`);
  await page.getByRole('row').nth(1).waitFor();
  await shoot(page, `activity-log-${lang}-${vp}`, lang);
}

async function createAndDuplicate(page, lang, vp) {
  const t = T[lang];
  const name = `Evidence ${lang} ${vp} ${RUN}`;
  await page.getByRole('button', { name: t('rbac.new-role'), exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: t('rbac.name') }).fill(name);
  await dialog.getByRole('button', { name: t('rbac.save'), exact: true }).click();
  await roleRow(page, name).waitFor();
  await roleRow(page, name)
    .getByRole('button', { name: t('rbac.row-actions') })
    .click();
  await page.getByRole('menuitem', { name: t('rbac.duplicate'), exact: true }).click();
  await page
    .getByRole('row')
    .filter({ hasText: name })
    .filter({ hasText: lang === 'ar' ? '(نسخة)' : '(copy)' })
    .waitFor();
  await page.getByText(t('rbac.duplicated'), { exact: true }).first().waitFor();
}

async function shootOwnerScreens(browser, lang, vp) {
  const t = T[lang];
  const page = await signedIn(browser, { email: OWNER, lang, vp });
  try {
    await openRoles(page, t);
    await shoot(page, `roles-table-${lang}-${vp}`, lang);
    await page.getByRole('button', { name: t('rbac.new-role'), exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('[data-slot="accordion-item"]').first().waitFor();
    const areas = await dialog.locator('[data-slot="accordion-item"]').count();
    if (areas !== 12) fail(`${lang} ${vp}: ${areas} areas in the dialog`);
    await shoot(page, `role-dialog-top-${lang}-${vp}`, lang);
    await dialog.locator('[data-slot="accordion-item"]').first().getByRole('button').first().click();
    await dialog.getByText(t('rbac.sensitive'), { exact: true }).first().waitFor();
    await dialog.getByText(t('rbac.sensitive'), { exact: true }).first().scrollIntoViewIfNeeded();
    await shoot(page, `role-dialog-area-${lang}-${vp}`, lang);
    await page.keyboard.press('Escape');
    await createAndDuplicate(page, lang, vp);
    await shoot(page, `roles-duplicate-${lang}-${vp}`, lang);
    await shootActivity(page, lang, vp);
  } finally {
    await page.context().close();
  }
}

/** A member who may read roles sees them, and none of the write controls: the page follows the server's answer. */
async function proveReadOnlyMember(browser, lang, vp) {
  const t = T[lang];
  const page = await signedIn(browser, { email: LIMITED, lang, vp });
  try {
    await page.goto(`${base}/team/roles`);
    await roleRow(page, VIEWER_ROLE).waitFor();
    await settle(page);
    const newRole = await page.getByRole('button', { name: t('rbac.new-role'), exact: true }).count();
    const rowMenus = await page.getByRole('button', { name: t('rbac.row-actions') }).count();
    if (newRole !== 0 || rowMenus !== 0)
      fail(`${lang}: limited member sees ${newRole} New role, ${rowMenus} row menus`);
    await shoot(page, `member-limited-roles-${lang}-${vp}`, lang);
    if (vp === 'desktop')
      proved(`${lang}: a member with only team.roles.view sees the table, no New role button and no row menu.`);
  } finally {
    await page.context().close();
  }
}

async function proveNoNavEntry(browser, lang, vp) {
  const page = await signedIn(browser, { email: ORDERS_MEMBER, lang, vp });
  try {
    await settle(page);
    // A phone-width page does not mount the sidebar, so the missing link is only checked where the sidebar is.
    if (vp === 'desktop' && (await page.locator(ROLES_LINK).count()) !== 0)
      fail(`${lang}: the orders member has a Roles link`);
    const answer = await graphql(page, 'query { businessRoles { id } }');
    if (codeOf(answer) !== 'FORBIDDEN') fail(`${lang}: orders member got ${JSON.stringify(answer)}`);
    await page.goto(`${base}/team/roles`);
    await page.locator('p[role="alert"]').first().waitFor();
    await shoot(page, `member-no-roles-${lang}-${vp}`, lang);
    if (vp === 'desktop')
      proved(
        `${lang}: a member without team.roles.view has no nav entry; the query answers FORBIDDEN and the page says so.`,
      );
  } finally {
    await page.context().close();
  }
}

/** A refusal other than a taken name, from the real server, in the delete dialog of a role that still has a member. */
async function proveRefusal(browser, lang, vp) {
  const t = T[lang];
  const page = await signedIn(browser, { email: OWNER, lang, vp });
  try {
    await openRoles(page, t);
    await roleRow(page, VIEWER_ROLE)
      .getByRole('button', { name: t('rbac.row-actions') })
      .click();
    await page.getByRole('menuitem', { name: t('rbac.delete'), exact: true }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: t('rbac.delete'), exact: true })
      .click();
    await page.getByText(t('rbac.role-in-use')).first().waitFor();
    await shoot(page, `refusal-role-in-use-${lang}-${vp}`, lang);
    if (vp === 'desktop')
      proved(`${lang}: deleting a role that has a member shows the translated rbac.role-in-use message.`);
  } finally {
    await page.context().close();
  }
}

/**
 * The server cannot be made to fail this query on demand, so the browser drops the one request. It proves the page's
 * reaction only: the failure stays visible and no write control appears.
 */
async function provePermissionsFailureMessage(browser, lang, vp) {
  const t = T[lang];
  const page = await signedIn(browser, { email: OWNER, lang, vp });
  try {
    await page.route('**/admin-api**', (route) =>
      route.request().postData()?.includes('effectivePermissions') ? route.abort() : route.continue(),
    );
    await page.goto(`${base}/team/roles`);
    await page.getByRole('row').nth(1).waitFor();
    await page.getByText(t('rbac.error-generic')).first().waitFor();
    if ((await page.getByRole('button', { name: t('rbac.new-role'), exact: true }).count()) !== 0) {
      fail(`${lang}: write controls appeared without an effectivePermissions answer`);
    }
    await shoot(page, `permissions-failed-${lang}-${vp}`, lang);
    if (vp === 'desktop')
      proved(
        `${lang}: with effectivePermissions dropped in the browser the page shows the generic message and no write control.`,
      );
  } finally {
    await page.context().close();
  }
}

async function proveOtherStoreRefused(browser) {
  const page = await signedIn(browser, { email: LIMITED, lang: 'en' });
  try {
    const own = await graphql(page, 'query { businessRoles { id } }');
    if (codeOf(own) !== null) fail(`own store: ${JSON.stringify(own)}`);
    const other = await graphql(page, 'query { businessRoles { id } }', {}, OTHER_STORE_TOKEN);
    if (codeOf(other) !== 'FORBIDDEN') fail(`other store: ${JSON.stringify(other)}`);
    proved(
      "A selected-store member: businessRoles answers on their store and is FORBIDDEN with the other store's token.",
    );
  } finally {
    await page.context().close();
  }
}

/** Revokes or restores the viewer role's read right as the owner on the first api; the member is on the second. */
function setViewerRead(owner, roleId, on) {
  const input = on ? { grants: [VIEW_PERMISSION] } : { revokes: [VIEW_PERMISSION] };
  return graphql(
    owner,
    'mutation ($id: String!, $input: UpdateBusinessRoleInput!) { updateBusinessRole(id: $id, input: $input) { id } }',
    { id: roleId, input },
  );
}

async function proveChangeReachesSecondProcess(browser, lang, vp) {
  const t = T[lang];
  const owner = await signedIn(browser, { email: OWNER, lang: 'en' });
  const member = await signedIn(browser, { url: second, email: LIMITED, lang, vp });
  try {
    const roles = await graphql(owner, 'query { businessRoles { id name } }');
    const roleId = roles.data.businessRoles.find((role) => role.name === VIEWER_ROLE).id;
    await member.goto(`${second}/team/roles`);
    await roleRow(member, VIEWER_ROLE).waitFor();
    const before = await graphql(member, 'query { businessRoles { id } }');
    if (codeOf(before) !== null) fail(`before the change: ${JSON.stringify(before)}`);
    const revoked = await setViewerRead(owner, roleId, false);
    if (codeOf(revoked) !== null) fail(`revoke: ${JSON.stringify(revoked)}`);
    const after = await graphql(member, 'query { businessRoles { id } }');
    if (codeOf(after) !== 'FORBIDDEN') fail(`after the change: ${JSON.stringify(after)}`);
    if (vp === 'desktop')
      proved(
        `${lang}: the first request after the owner removed team.roles.view on one api is FORBIDDEN on the second api.`,
      );
    await member.reload();
    await member.getByText(t('rbac.error-forbidden')).first().waitFor();
    await shoot(member, `live-revoke-second-api-${lang}-${vp}`, lang);
    const restored = await setViewerRead(owner, roleId, true);
    if (codeOf(restored) !== null) fail(`restore: ${JSON.stringify(restored)}`);
    const again = await graphql(member, 'query { businessRoles { id } }');
    if (codeOf(again) !== null) fail(`after restoring: ${JSON.stringify(again)}`);
    if (vp === 'desktop') proved(`${lang}: the first request after restoring it is answered on the second api.`);
  } finally {
    await owner.context().close();
    await member.context().close();
  }
}

async function proveLoginFooter(browser) {
  const context = await browser.newContext(VIEWPORTS.desktop);
  try {
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.locator(LICENCE_FOOTER).waitFor();
    proved('The licence footer is on the login page.');
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    await proveLoginFooter(browser);
    for (const lang of LANGS) {
      for (const vp of Object.keys(VIEWPORTS)) await shootOwnerScreens(browser, lang, vp);
      for (const vp of Object.keys(VIEWPORTS)) {
        await proveReadOnlyMember(browser, lang, vp);
        await proveNoNavEntry(browser, lang, vp);
        await proveRefusal(browser, lang, vp);
        await provePermissionsFailureMessage(browser, lang, vp);
        await proveChangeReachesSecondProcess(browser, lang, vp);
      }
    }
    await proveOtherStoreRefused(browser);
  } finally {
    await browser.close();
  }
}

await main();
