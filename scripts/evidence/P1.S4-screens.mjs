// Browser part of scripts/evidence/P1.S4.sh: the team members page and its dialogs, the public accept page and the invitation
// mail, each in Arabic and English, desktop (1440x900) and mobile (390x844).
//
//   node P1.S4-screens.mjs <dashboard-url> <mailpit-url> <out-dir>
//
// Env: DEMO_OWNER_PASSWORD (read by the session helper, never printed), EV_PREVIEW_TOKEN (an open invitation's token, never
// printed nor shown: the accept page drops it from the address on load), EV_MAIL_EN and EV_MAIL_AR (an invitee who received
// an English or an Arabic invitation), EV_ACTIVE_EMAIL (an active member the actions are opened on).
/* global process, console, URL, document */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAsOwner, setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';
import { emailSecrets, waitForEmail } from '../../apps/server/tests/browser/mailpit.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, mailpitArg, outDir] = process.argv.slice(2);
if (!baseArg || !mailpitArg || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const mailpit = mailpitArg.replace(/\/$/, '');
const {
  EV_PREVIEW_TOKEN: PREVIEW_TOKEN,
  EV_MAIL_EN: MAIL_EN,
  EV_MAIL_AR: MAIL_AR,
  EV_ACTIVE_EMAIL: ACTIVE,
} = process.env;
if (!PREVIEW_TOKEN || !MAIL_EN || !MAIL_AR || !ACTIVE)
  throw new Error('EV_PREVIEW_TOKEN, EV_MAIL_EN, EV_MAIL_AR, EV_ACTIVE_EMAIL');

const MAX_BYTES = 300 * 1024;
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const OWNER = 'owner@demo.example.test';
const SECOND_OWNER = 'owner@second.example.test';
const TEAM_PAGE = '[data-testid="team-members-page"]';
const ACCEPT_PAGE = '[data-testid="accept-invitation-page"]';
const PUBLIC_LANGUAGE = { ar: 'العربية', en: 'English' };
/** The Order manager built-in role's label (`packages/shared/src/permissions/built-in-roles.ts`). */
const ORDER_MANAGER = { ar: 'مسؤول الطلبات', en: 'Order manager' };
const REDACTED_LINK = '[REDACTED_TOKEN]';

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

function catalogue(lang) {
  const entries = new Map();
  const po = readFileSync(join(root, `plugins/team/dashboard/i18n/${lang}.po`), 'utf8');
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

async function save(page, name, fullPage) {
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  console.error(`shot ${name}`);
}

/** A page of the dashboard: right direction, no horizontal overflow, no table clipped by its container. */
async function shoot(page, name, lang, { fullPage = true } = {}) {
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
  await save(page, name, fullPage);
}

async function signedIn(browser, { email = OWNER, lang, vp }) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  // The user menu lives in the sidebar, which a phone-width page hides: sign in wide, then narrow to the shot's size.
  await page.setViewportSize(VIEWPORTS.desktop.viewport);
  await loginAsOwner(page, base, email);
  await setDisplayLanguage(page, lang);
  await page.setViewportSize(VIEWPORTS[vp].viewport);
  return page;
}

const tab = (page, t, id) => page.getByRole('tab', { name: new RegExp(`^${t(id)}`) });
const memberRow = (page, email) => page.getByRole('row').filter({ hasText: email });

async function openTeam(page, t) {
  await page.goto(`${base}/team`);
  await page.locator(TEAM_PAGE).waitFor();
  await tab(page, t, 'team.tab-all').waitFor();
}

async function shootTabs(page, lang, vp) {
  const t = T[lang];
  await memberRow(page, ACTIVE).waitFor();
  await shoot(page, `team-all-${lang}-${vp}`, lang);
  await tab(page, t, 'team.tab-pending').click();
  // The active member leaving the table is what shows the Pending tab's answer has replaced the All tab's.
  await memberRow(page, ACTIVE).waitFor({ state: 'detached' });
  await page.getByText(t('team.status-pending'), { exact: true }).first().waitFor();
  await shoot(page, `team-pending-${lang}-${vp}`, lang);
  await tab(page, t, 'team.tab-all').click();
  await memberRow(page, ACTIVE).waitFor();
}

async function shootInviteDialog(page, lang, vp) {
  const t = T[lang];
  await page.getByRole('button', { name: t('team.invite-button'), exact: true }).click();
  const dialog = page.getByRole('dialog');
  const submit = dialog.getByRole('button', { name: t('team.invite-submit') });
  await dialog.getByRole('checkbox', { name: ORDER_MANAGER[lang], exact: true }).waitFor();
  await shoot(page, `invite-empty-${lang}-${vp}`, lang, { fullPage: false });
  await dialog.getByRole('textbox', { name: t('team.field-email') }).fill('not-an-email');
  await dialog.getByRole('textbox', { name: t('team.field-salary') }).fill('-5');
  for (const id of ['team.invite-error-email', 'team.invite-error-roles', 'team.invite-error-salary']) {
    await dialog.getByText(t(id), { exact: true }).waitFor();
  }
  if (!(await submit.isDisabled())) fail(`${lang} ${vp}: Send invitation is enabled on an invalid form`);
  await shoot(page, `invite-errors-${lang}-${vp}`, lang, { fullPage: false });
  await dialog.getByRole('textbox', { name: t('team.field-email') }).fill(`new.member.${vp}@invitee.example.test`);
  await dialog.getByRole('checkbox', { name: ORDER_MANAGER[lang], exact: true }).click();
  await dialog.getByRole('textbox', { name: t('team.field-salary') }).fill('28000');
  if (await submit.isDisabled()) fail(`${lang} ${vp}: Send invitation is disabled on a valid form`);
  await shoot(page, `invite-filled-${lang}-${vp}`, lang, { fullPage: false });
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  proved(
    `${lang} ${vp}: the invite dialog shows the email, role and salary errors with Send disabled, and enables it once valid.`,
  );
}

async function shootRowDialogs(page, lang, vp) {
  const t = T[lang];
  const row = memberRow(page, ACTIVE);
  await row.getByRole('button', { name: t('team.row-actions') }).click();
  for (const id of [
    'team.action-view',
    'team.action-set-limit',
    'team.action-stop-receiving',
    'team.action-deactivate',
  ]) {
    await page.getByRole('menuitem', { name: t(id), exact: true }).waitFor();
  }
  await shoot(page, `actions-menu-${lang}-${vp}`, lang, { fullPage: false });
  await page.getByRole('menuitem', { name: t('team.action-set-limit'), exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox').waitFor();
  await shoot(page, `set-limit-${lang}-${vp}`, lang, { fullPage: false });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  // A phone offers Pay salary in the row menu, as its button would push the table sideways.
  if (vp === 'mobile') {
    await row.getByRole('button', { name: t('team.row-actions') }).click();
    await page.getByRole('menuitem', { name: t('team.pay-salary'), exact: true }).click();
  } else {
    await row.getByRole('button', { name: t('team.pay-salary'), exact: true }).click();
  }
  await page.getByRole('dialog').getByText(t('team.pay-placeholder-note'), { exact: true }).waitFor();
  await shoot(page, `pay-salary-${lang}-${vp}`, lang, { fullPage: false });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  proved(
    `${lang} ${vp}: the row menu offers view, set limit, stop receiving and deactivate; set limit and pay salary open their dialogs.`,
  );
}

async function shootOwnerScreens(browser, lang, vp) {
  const page = await signedIn(browser, { lang, vp });
  try {
    await openTeam(page, T[lang]);
    await shootTabs(page, lang, vp);
    await shootInviteDialog(page, lang, vp);
    await shootRowDialogs(page, lang, vp);
  } finally {
    await page.context().close();
  }
}

/** Business B has no deactivated member, so its Inactive tab is the empty state. */
async function shootEmptyState(browser, lang, vp) {
  const t = T[lang];
  const page = await signedIn(browser, { email: SECOND_OWNER, lang, vp });
  try {
    await openTeam(page, t);
    await tab(page, t, 'team.tab-inactive').click();
    await page.getByText(t('team.empty'), { exact: true }).waitFor();
    await shoot(page, `team-empty-${lang}-${vp}`, lang);
    proved(`${lang} ${vp}: a tab with no member shows the empty-state message.`);
  } finally {
    await page.context().close();
  }
}

async function shootAcceptPage(browser, lang, vp) {
  const t = T[lang];
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto(`${base}/accept-invitation?token=${PREVIEW_TOKEN}`);
    await page.locator(ACCEPT_PAGE).waitFor();
    await page.getByRole('button', { name: PUBLIC_LANGUAGE[lang], exact: true }).click();
    await page.getByRole('textbox', { name: t('team.accept-first-name') }).waitFor();
    if (new URL(page.url()).search !== '') fail(`${lang} ${vp}: the token is still in the address`);
    if ((await page.content()).includes(PREVIEW_TOKEN)) fail(`${lang} ${vp}: the token is in the page`);
    await shoot(page, `accept-invitation-${lang}-${vp}`, lang);
    proved(
      `${lang} ${vp}: the accept page shows the form for an open invitation and its address no longer holds the token.`,
    );
  } finally {
    await context.close();
  }
}

/** The mail as Mailpit received it, rendered alone with its link's token replaced. */
async function shootMail(browser, lang, vp) {
  const mail = await waitForEmail(mailpit, lang === 'ar' ? MAIL_AR : MAIL_EN, { contains: '/accept-invitation' });
  const { token } = emailSecrets(mail);
  if (!token || !mail.html.includes(token)) fail(`${lang}: the mail has no link token`);
  const html = mail.html.split(token).join(REDACTED_LINK);
  if (html.includes(token)) fail(`${lang}: redaction failed`);
  if (lang === 'ar' && !/dir="?rtl/i.test(html)) fail('the Arabic mail is not right-to-left');
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.route('**/*', (route) => route.abort());
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    await save(page, `invitation-mail-${lang}-${vp}`, true);
    proved(
      `${lang} ${vp}: the invitation mail (subject "${mail.subject}") renders; its link's token is redacted in the shot.`,
    );
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const lang of LANGS) {
      for (const vp of Object.keys(VIEWPORTS)) {
        await shootOwnerScreens(browser, lang, vp);
        await shootEmptyState(browser, lang, vp);
        await shootAcceptPage(browser, lang, vp);
        await shootMail(browser, lang, vp);
      }
    }
  } finally {
    await browser.close();
  }
}

await main();
