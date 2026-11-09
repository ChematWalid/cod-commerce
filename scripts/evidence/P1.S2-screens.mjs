// Browser part of scripts/evidence/P1.S2.sh: registers one Arabic and one English merchant through the wizard, takes the
// screenshots (desktop and mobile, AR and EN), then runs what earlier tasks could not exercise: the address suffix,
// availability retry after a real 429 and a failed check, the token leaving the URL, a successful password and email
// change and reset, confirm-email-change, and the provider buttons with the OAuth flag on and off.
//
//   node P1.S2-screens.mjs <dashboard-url> <oauth-dashboard-url> <mailpit-url> <out-dir>
//
// Env: EV_PASSWORD, EV_NEW_PASSWORD, EV_RESET_PASSWORD (synthetic, never printed), EV_RUN (unique suffix), EV_OAUTH_EMAIL,
// SUPERADMIN_USERNAME (read by the session helper). Node 24 strips the types of the imported .ts files.
/* global process, console, URL, document, location, fetch, localStorage -- Node globals, and browser globals inside page.evaluate */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDisplayLanguage } from '../../apps/server/tests/browser/dashboard-session.ts';
import { emailSecrets, waitForEmail } from '../../apps/server/tests/browser/mailpit.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { chromium } = createRequire(join(root, 'apps/server/package.json'))('playwright-core');

const [baseArg, oauthArg, mailpit, outDir] = process.argv.slice(2);
if (!baseArg || !oauthArg || !mailpit || !outDir) throw new Error('usage: see the header of this file');
const base = baseArg.replace(/\/$/, '');
const oauthBase = oauthArg.replace(/\/$/, '');
const {
  EV_PASSWORD: PASSWORD,
  EV_NEW_PASSWORD: NEW_PASSWORD,
  EV_RESET_PASSWORD: RESET_PASSWORD,
  EV_RUN: RUN,
} = process.env;
const { EV_OAUTH_EMAIL: OAUTH_EMAIL } = process.env;
if (!PASSWORD || !NEW_PASSWORD || !RESET_PASSWORD || !RUN || !OAUTH_EMAIL) throw new Error('EV_* must be set');

const MAX_BYTES = 300 * 1024;
const PLATFORM_SUFFIX = '.localhost';
const LANGS = ['ar', 'en'];
const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
};
const BANNER = 'verify-email-banner';
const WIZARD = 'register-wizard';
const LICENCE_FOOTER = '[data-vendure-branding]';
const HAMMER_LIMIT_MS = 15_000;
const STALE_CHANNEL_KEY = 'vendure-selected-channel-token';

/** @returns {never} */
function fail(message) {
  throw new Error(message);
}

/** The catalogue as the pages use it, so a selector can never drift from the text. */
function catalogue(lang) {
  const entries = new Map();
  const po = readFileSync(join(root, `plugins/auth/dashboard/i18n/${lang}.po`), 'utf8');
  for (const [, id, text] of po.matchAll(/^msgid "(.+)"\nmsgstr "(.*)"$/gm)) entries.set(id, text);
  return (id) => entries.get(id) ?? fail(`${lang}.po has no ${id}`);
}
const T = { ar: catalogue('ar'), en: catalogue('en') };

const merchants = Object.fromEntries(
  LANGS.map((lang) => [
    lang,
    {
      lang,
      email: `owner-${lang}-${RUN}@evidence.example.test`,
      newEmail: `owner-${lang}-new-${RUN}@evidence.example.test`,
      subdomain: `ev-${lang}-${RUN}`,
      state: undefined,
    },
  ]),
);

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      '*, *::before, *::after { caret-color: transparent !important; animation: none !important; transition: none !important; }',
  });
}

const shots = [];
async function shoot(page, name, lang) {
  await settle(page);
  if (lang) {
    const dir = await page.evaluate(() => document.documentElement.dir);
    if (dir !== (lang === 'ar' ? 'rtl' : 'ltr')) fail(`${name}: dir is ${dir}`);
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 1) fail(`${name}: ${overflow}px of horizontal overflow`);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (statSync(file).size > MAX_BYTES) fail(`${name}: ${statSync(file).size} bytes`);
  shots.push(name);
  console.error(`shot ${name}`);
}

/** A public page in `lang`: the language switch writes the real settings, which every later context inherits. */
async function publicState(browser, lang) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/register`);
    await page.getByTestId(WIZARD).waitFor();
    await page.locator(`button[lang="${lang}"]`).click();
    await page.waitForFunction((d) => document.documentElement.dir === d, lang === 'ar' ? 'rtl' : 'ltr');
    return await context.storageState();
  } finally {
    await context.close();
  }
}

const field = (page, name, exact = false) => page.getByRole('textbox', { name, exact });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const stepText = (lang, current) =>
  T[lang]('Step {current} of {total}').replace('{current}', String(current)).replace('{total}', '3');

async function fillAccountStep(page, lang, email) {
  const t = T[lang];
  await field(page, t('Email')).fill(email);
  await field(page, t('Password'), true).fill(PASSWORD);
  await field(page, t('First name')).fill(lang === 'ar' ? 'سارة' : 'Sara');
  await field(page, t('Last name')).fill(lang === 'ar' ? 'بن علي' : 'Benali');
}

async function toBusinessStep(page, lang) {
  await button(page, T[lang]('Continue')).click();
  await page.getByText(stepText(lang, 2)).waitFor();
}

async function toStoreStep(page, lang, businessName) {
  await field(page, T[lang]('Business name')).fill(businessName);
  await button(page, T[lang]('Continue')).click();
  await page.getByText(stepText(lang, 3)).waitFor();
}

/** The suffix is the configured domain, and the input-then-suffix row stays left to right on an Arabic page. */
async function assertSuffix(page, lang) {
  const suffix = page.getByText(PLATFORM_SUFFIX, { exact: true });
  await suffix.waitFor();
  const input = await field(page, T[lang]('Store address')).boundingBox();
  const box = await suffix.boundingBox();
  if (box.x < input.x + input.width) fail(`${lang}: the suffix is not to the right of the address input`);
}

async function shootPublicPages(browser, lang, vp, storageState) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], storageState, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    const open = async (path, name) => {
      await page.goto(`${base}${path}`);
      await page.locator(LICENCE_FOOTER).waitFor();
      await shoot(page, `${name}-${lang}-${vp}`, lang);
    };
    await open('/login', 'login');
    await open('/forgot-password', 'forgot');
    await open('/reset-password?token=evidence-not-a-real-token', 'reset');
    await open('/verify-email?token=evidence-not-a-real-token', 'verify');
    await page.goto(`${base}/register`);
    await page.getByTestId(WIZARD).waitFor();
    await shoot(page, `register-1-${lang}-${vp}`, lang);
    await fillAccountStep(page, lang, `shot-${RUN}@evidence.example.test`);
    await toBusinessStep(page, lang);
    await shoot(page, `register-2-${lang}-${vp}`, lang);
    await toStoreStep(page, lang, 'Shot');
    await field(page, T[lang]('Store name')).fill('Shot');
    await field(page, T[lang]('Store address')).fill(`free-${RUN}`);
    await page.getByText(T[lang]('subdomain.available')).waitFor();
    await assertSuffix(page, lang);
    await shoot(page, `register-3-${lang}-${vp}`, lang);
  } finally {
    await context.close();
  }
}

/** Through the real wizard, ending on Home of the new store with the banner up; the stale channel must not matter. */
async function registerMerchant(browser, merchant, storageState) {
  const { lang, email, subdomain } = merchant;
  const context = await browser.newContext({ ...VIEWPORTS.desktop, storageState, reducedMotion: 'reduce' });
  try {
    await context.addInitScript(
      ([key]) => localStorage.setItem(key, 'stale-channel-of-a-previous-account'),
      [STALE_CHANNEL_KEY],
    );
    const page = await context.newPage();
    await page.goto(`${base}/register`);
    await page.getByTestId(WIZARD).waitFor();
    await fillAccountStep(page, lang, email);
    await toBusinessStep(page, lang);
    await toStoreStep(page, lang, lang === 'ar' ? 'شركة الاختبار' : 'Evidence Business');
    await field(page, T[lang]('Store name')).fill(lang === 'ar' ? 'متجر الاختبار' : 'Evidence Store');
    await field(page, T[lang]('Store address')).fill('demo');
    await page.getByText(T[lang]('subdomain.taken')).waitFor();
    await field(page, T[lang]('Store address')).fill(subdomain);
    await page.getByText(T[lang]('subdomain.available')).waitFor();
    await button(page, T[lang]('Create')).click();
    await page.getByTestId(BANNER).waitFor();
    if (new URL(page.url()).pathname.replace(/\/$/, '') !== new URL(base).pathname)
      fail(`${lang}: not on Home: ${page.url()}`);
    await setDisplayLanguage(page, lang);
    merchant.state = await context.storageState();
  } finally {
    await context.close();
  }
}

async function shootMerchantPages(browser, merchant, vp) {
  const { lang } = merchant;
  const context = await browser.newContext({ ...VIEWPORTS[vp], storageState: merchant.state, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/`);
    await page.getByTestId(BANNER).waitFor();
    await shoot(page, `banner-${lang}-${vp}`, lang);
    await page.goto(`${base}/account/profile`);
    await field(page, T[lang]('First name')).waitFor();
    await shoot(page, `profile-${lang}-${vp}`, lang);
    await page.goto(`${base}/account/security`);
    await field(page, T[lang]('New email')).waitFor();
    await shoot(page, `security-${lang}-${vp}`, lang);
  } finally {
    await context.close();
  }
}

/** A real 429 from the server, then the same value recovers with no edit. Also a failed check, which retries by itself. */
async function availabilityRetry(browser, lang, storageState) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop, storageState, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/register`);
    await page.getByTestId(WIZARD).waitFor();
    await fillAccountStep(page, lang, `retry-${RUN}@evidence.example.test`);
    await toBusinessStep(page, lang);
    await toStoreStep(page, lang, 'Retry');
    await field(page, T[lang]('Store name')).fill('Retry');
    const address = field(page, T[lang]('Store address'));
    const create = button(page, T[lang]('Create'));

    // The bucket refills one token a second: keep it empty until the field's own check has been refused.
    const value = `retry-${lang}-${RUN}`;
    const refused = page.waitForResponse((r) => r.url().includes(`subdomain=${value}`) && r.status() === 429);
    const hammering = page.evaluate(async (limitMs) => {
      globalThis.evidenceHammer = true;
      const end = Date.now() + limitMs;
      while (globalThis.evidenceHammer && Date.now() < end)
        await fetch('/stores/subdomain-availability?subdomain=burst-probe');
    }, HAMMER_LIMIT_MS);
    await page.waitForResponse((r) => r.url().includes('burst-probe') && r.status() === 429);
    await address.fill(value);
    await refused;
    await page.evaluate(() => (globalThis.evidenceHammer = false));
    await hammering;
    await page.getByText(T[lang]('subdomain.rate-limited')).waitFor({ timeout: 2000 });
    if (await create.isEnabled()) fail('Create is enabled while rate limited');
    await shoot(page, `register-rate-limited-${lang}-desktop`, lang);
    await page.getByText(T[lang]('subdomain.available')).waitFor({ timeout: 30_000 });
    if (await create.isDisabled()) fail('Create stayed disabled after the 429 retry');

    let failures = 0;
    await page.route('**/stores/subdomain-availability*', async (route) => {
      if (failures === 0) {
        failures += 1;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await address.fill(`again-${lang}-${RUN}`);
    await page.getByText(T[lang]('subdomain.check-failed')).waitFor();
    if (await create.isEnabled()) fail('Create is enabled after a failed check');
    await page.getByText(T[lang]('subdomain.available')).waitFor({ timeout: 30_000 });
    console.error(`availability retry ${lang}: 429 and failed check both recovered`);
  } finally {
    await context.close();
  }
}

async function signIn(page, username, password) {
  await page.goto(`${base}/login`);
  await page.getByRole('textbox', { name: 'Email' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  await page.locator('[data-sidebar="sidebar"]').first().waitFor();
}

function assertNoToken(page, label) {
  if (page.url().includes('token') || new URL(page.url()).search !== '')
    fail(`${label}: the token is still in ${page.url()}`);
}

async function confirmLink(browser, merchant, url, title, action, done, shotName) {
  const { lang } = merchant;
  const context = await browser.newContext({
    ...VIEWPORTS.desktop,
    reducedMotion: 'reduce',
    storageState: merchant.publicState,
  });
  try {
    const page = await context.newPage();
    const spends = [];
    page.on('request', (r) => {
      if (/verifyEmail|confirmEmailChange/.test(r.postData() ?? '')) spends.push(r);
    });
    await page.goto(url);
    await page.getByRole('heading', { name: title }).waitFor();
    await settle(page);
    if (spends.length !== 0) fail(`${shotName}: the page spent the token on load`);
    await shoot(page, `${shotName}-${lang}-desktop`, lang);
    await button(page, action).click();
    await page.getByRole('status').getByText(done).waitFor();
    assertNoToken(page, shotName);
    await shoot(page, `${shotName}-done-${lang}-desktop`, lang);
    console.error(`${shotName} ${lang}: confirmed, token left the URL`);
  } finally {
    await context.close();
  }
}

async function verifyWithOtp(browser, merchant) {
  const { lang, email } = merchant;
  const context = await browser.newContext({
    ...VIEWPORTS.desktop,
    storageState: merchant.state,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/`);
    const banner = page.getByTestId(BANNER);
    await banner.waitFor();
    const { code } = emailSecrets(await waitForEmail(mailpit, email, { contains: '/verify-email' }));
    await banner.getByRole('textbox').fill(code ?? fail('no code'));
    await banner.getByRole('button', { name: T[lang]('Verify'), exact: true }).click();
    await banner.waitFor({ state: 'detached', timeout: 15_000 });
    console.error(`otp ${lang}: banner gone`);
  } finally {
    await context.close();
  }
}

async function securityFlows(browser, merchant) {
  const { lang, newEmail } = merchant;
  const t = T[lang];
  const context = await browser.newContext({
    ...VIEWPORTS.desktop,
    storageState: merchant.state,
    reducedMotion: 'reduce',
  });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/account/security`);
    const [current, fresh, confirmation, emailPassword] = [
      field(page, t('Current password')).first(),
      field(page, t('New password'), true),
      field(page, t('Confirm new password')),
      field(page, t('Current password')).nth(1),
    ];
    await current.fill(PASSWORD);
    await fresh.fill(NEW_PASSWORD);
    await confirmation.fill(NEW_PASSWORD);
    await button(page, t('Change password')).click();
    await page.getByText(t('Password changed')).first().waitFor();
    await shoot(page, `security-password-changed-${lang}-desktop`, lang);
    await field(page, t('New email')).fill(newEmail);
    await emailPassword.fill(NEW_PASSWORD);
    await button(page, t('Change email')).click();
    await page.getByRole('status').getByText(newEmail).first().waitFor();
    await shoot(page, `security-email-pending-${lang}-desktop`, lang);
  } finally {
    await context.close();
  }
}

async function completeEmailChangeAndReset(browser, merchant) {
  const { lang, newEmail } = merchant;
  const t = T[lang];
  const link = await waitForEmail(mailpit, newEmail, { contains: '/confirm-email-change' });
  const { token } = emailSecrets(link);
  await confirmLink(
    browser,
    merchant,
    `${base}/confirm-email-change?token=${token}`,
    t('Confirm your new email'),
    t('Confirm new email'),
    t('Your email address has been changed'),
    'confirm-email',
  );
  const context = await browser.newContext({ ...VIEWPORTS.desktop, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await signIn(page, newEmail, NEW_PASSWORD);
    console.error(`${lang}: signed in with the new email and the new password`);
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${base}/forgot-password`);
    await page.getByRole('textbox', { name: 'Email' }).fill(newEmail);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await page.getByText('Check your email').waitFor();
    const reset = emailSecrets(await waitForEmail(mailpit, newEmail, { contains: '/reset-password' }));
    await page.goto(`${base}/reset-password?token=${reset.token}`);
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill(RESET_PASSWORD);
    await page.getByRole('textbox', { name: 'Confirm new password' }).fill(RESET_PASSWORD);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/reset-password'));
    await page.locator('[data-sidebar="sidebar"]').first().waitFor();
    console.error(`${lang}: reset through the stock pages landed signed in`);
  } finally {
    await context.close();
  }
}

/** With the flag on (separate api process): both buttons, the redirect through the mock, and a provider sign-up. */
async function oauthOn(browser) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${oauthBase}/login`);
    const google = page.getByText('Continue with Google');
    await google.waitFor();
    await page.getByText('Continue with Facebook').waitFor();
    await shoot(page, 'oauth-on-login-en-desktop', 'en');
    await page.goto(`${oauthBase}/register`);
    await page.getByTestId(WIZARD).getByText('Continue with Google').waitFor();
    await shoot(page, 'oauth-on-register-en-desktop', 'en');
    await page.getByText('Continue with Google').click();
    await page.waitForURL((url) => url.pathname.endsWith('/register') && url.searchParams.has('ticket'));
    await page.getByTestId(WIZARD).waitFor();
    const email = page.getByRole('textbox', { name: 'Email' });
    await page.waitForFunction((value) => document.querySelector('input[type="email"]')?.value === value, OAUTH_EMAIL);
    if ((await email.inputValue()) !== OAUTH_EMAIL) fail('the provider email was not prefilled');
    if ((await page.getByRole('textbox', { name: 'Password', exact: true }).count()) !== 0)
      fail('a provider sign-up asks for a password');
    await shoot(page, 'oauth-on-register-prefilled-en-desktop', 'en');
    await toBusinessStep(page, 'en');
    await toStoreStep(page, 'en', 'Oauth Business');
    await field(page, T.en('Store name')).fill('Oauth Store');
    await field(page, T.en('Store address')).fill(`oauth-${RUN}`);
    await page.getByText(T.en('subdomain.available')).waitFor();
    await button(page, T.en('Create')).click();
    await page.waitForFunction(
      () => location.pathname.replace(/\/$/, '') === '/dashboard' && document.querySelector('[data-sidebar="sidebar"]'),
    );
    await settle(page);
    if ((await page.getByTestId(BANNER).count()) !== 0) fail('a provider-confirmed email still shows the banner');
    console.error('oauth on: both buttons, provider sign-up through the mock landed on Home, no banner');
  } finally {
    await context.close();
  }
}

async function oauthOff(browser) {
  const context = await browser.newContext({ ...VIEWPORTS.desktop, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/login`);
    await page.getByRole('link', { name: 'Create account' }).waitFor();
    await settle(page);
    if ((await page.getByText('Continue with').count()) !== 0) fail('a provider button shows with the flag off');
    if ((await page.locator(LICENCE_FOOTER).count()) !== 1) fail('the login footer is missing');
    console.error('oauth off: no provider button; login footer present');
  } finally {
    await context.close();
  }
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const publicStates = Object.fromEntries(
    await Promise.all(LANGS.map(async (l) => [l, await publicState(browser, l)])),
  );
  for (const lang of LANGS) {
    merchants[lang].publicState = publicStates[lang];
    for (const vp of Object.keys(VIEWPORTS)) await shootPublicPages(browser, lang, vp, publicStates[lang]);
    await availabilityRetry(browser, lang, publicStates[lang]);
    await registerMerchant(browser, merchants[lang], publicStates[lang]);
    for (const vp of Object.keys(VIEWPORTS)) await shootMerchantPages(browser, merchants[lang], vp);
  }
  // Arabic verifies by the link (in a browser with no session), English by the code.
  const ar = merchants.ar;
  const { token } = emailSecrets(await waitForEmail(mailpit, ar.email, { contains: '/verify-email' }));
  await confirmLink(
    browser,
    ar,
    `${base}/verify-email?token=${token}`,
    T.ar('Verify your email'),
    T.ar('Verify my email'),
    T.ar('Your email is verified'),
    'verify-link',
  );
  await verifyWithOtp(browser, merchants.en);
  for (const lang of LANGS) {
    await securityFlows(browser, merchants[lang]);
    await completeEmailChangeAndReset(browser, merchants[lang]);
  }
  await oauthOff(browser);
  await oauthOn(browser);
} finally {
  await browser.close();
}
console.log(shots.sort().join('\n'));
