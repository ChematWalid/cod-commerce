import type { DocumentLang } from '@cod/plugin-merchant-shell';
import type { Locator, Page, Response } from 'playwright-core';

/**
 * Accessible names of the `@vendure/dashboard` 3.8.1 controls this session drives, confirmed against its
 * DOM (2026-11-08). The login page is always English here: each test opens a fresh browser context, whose
 * empty `localStorage` starts in the default language. The user menu follows the display language, so its
 * names cover English and Arabic.
 */
export const DASHBOARD_LABELS = {
  /** Login textboxes, named by their placeholders. */
  email: 'Email',
  password: 'Password',
  signIn: /sign in|log in/i,
  /** The user menu item that opens the language dialog: "Language English" or "اللغة العربية". */
  languageItem: /^(Language|اللغة)\s/,
} as const;

/** The `data-testid`s of the merchant's account menu and its rows (node runs this file without path mapping). */
const ACCOUNT_MENU_TEST_ID = 'account-menu';
const ACCOUNT_LANGUAGE_TEST_ID = 'account-menu-language';
const ACCOUNT_LOGOUT_TEST_ID = 'account-menu-logout';

/** The GraphQL mutation that stores the user settings, the display language included, on the server. */
const SAVE_SETTINGS_MUTATION = 'setSettingsStoreValue';

/** The `data-testid` of the auth plugin's verification banner (node runs this file without path mapping). */
const VERIFY_BANNER_TEST_ID = 'verify-email-banner';

/** The first demo business's owner (`pnpm --filter @cod/server seed:demo`): a merchant, with no platform role. */
export const DEMO_OWNER_EMAIL = 'owner@demo.example.test';

/** The superadmin of `.env` (`SUPERADMIN_*`), the platform account; it has no tenant on the default channel. */
function superadminCredentials(): { username: string; password: string } {
  const username = process.env['SUPERADMIN_USERNAME'];
  const password = process.env['SUPERADMIN_PASSWORD'];
  if (!username || !password) {
    throw new Error('SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set (apps/server/.env)');
  }
  return { username, password };
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The sidebar's user menu trigger, named "<first> <last> <identifier>" (an owner's e-mail or the superadmin). */
const userMenuTrigger = (page: Page): Locator =>
  page.getByRole('button', {
    name: new RegExp(`(@[\\w.-]+\\.test|${escapeRegExp(superadminCredentials().username)})$`),
    // A role query skips hidden elements, and the shell hides this one from merchants (D79).
    includeHidden: true,
  });

/** The merchant's account menu button in the top bar. */
const accountMenuTrigger = (page: Page): Locator => page.locator(`[data-testid="${ACCOUNT_MENU_TEST_ID}"]`);

/** Signs in on the dashboard login page and waits until the app shell has replaced it. */
async function login(page: Page, baseUrl: string, username: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: DASHBOARD_LABELS.email }).fill(username);
  await page.getByRole('textbox', { name: DASHBOARD_LABELS.password }).fill(password);
  await page.getByRole('button', { name: DASHBOARD_LABELS.signIn }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  // A merchant gets the account menu, platform staff the stock user menu; the stock one is hidden from merchants (D79).
  await accountMenuTrigger(page).or(userMenuTrigger(page)).first().waitFor({ state: 'attached' });
}

/** Signs in as the platform superadmin. Tenant pages answer FORBIDDEN for it on the default channel. */
export async function loginAsSuperadmin(page: Page, baseUrl: string): Promise<void> {
  const { username, password } = superadminCredentials();
  await login(page, baseUrl, username, password);
}

/** Signs in as an owner the demo seed created, who lands on one of that business's stores. */
export async function loginAsOwner(page: Page, baseUrl: string, email: string): Promise<void> {
  const password = process.env['DEMO_OWNER_PASSWORD'];
  if (!password) throw new Error('DEMO_OWNER_PASSWORD must be set to the value the demo seed ran with');
  await login(page, baseUrl, email, password);
}

/** Signs in as the first demo business's owner. */
export const loginAsDemoOwner = (page: Page, baseUrl: string): Promise<void> =>
  loginAsOwner(page, baseUrl, DEMO_OWNER_EMAIL);

/** Waits for a page's queries, then fails if the page reports one as failed instead of showing its content. */
export async function assertNoPageError(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // The verification banner is also an alert, and a seeded owner's email is unverified by design.
  const alerts = page.locator(`[role="alert"]:not([data-testid="${VERIFY_BANNER_TEST_ID}"])`);
  if ((await alerts.count()) > 0) throw new Error(`the page shows an error: ${await alerts.first().innerText()}`);
}

/** The dashboard's localStorage key of the selected channel token (`@vendure/dashboard` storage-keys.ts). */
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';

/** Creates a note in the store the dashboard has selected, through the Admin API, with the signed-in session. */
export async function createNoteInSelectedStore(page: Page, title: string): Promise<void> {
  const errors = await page.evaluate(
    async ([key, noteTitle]) => {
      const response = await fetch('/admin-api', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
        body: JSON.stringify({
          query: 'mutation ($input: CreateTemplateNoteInput!) { createTemplateNote(input: $input) { id } }',
          variables: { input: { title: noteTitle, body: 'browser test' } },
        }),
      });
      return ((await response.json()) as { errors?: unknown }).errors;
    },
    [SELECTED_CHANNEL_KEY, title] as const,
  );
  if (errors !== undefined) throw new Error(`createTemplateNote failed: ${JSON.stringify(errors)}`);
}

const isSettingsSave = (response: Response): boolean =>
  response.request().postData()?.includes(SAVE_SETTINGS_MUTATION) ?? false;

/**
 * Switches the display language as a user would, and waits until the server has stored it. A merchant uses the account
 * menu's Language radio, platform staff the stock user menu's dialog. Writing `localStorage` alone does not stick: the
 * server-stored user settings overwrite it on the next load (spike A, ADR 0010).
 */
export async function setDisplayLanguage(page: Page, language: DocumentLang): Promise<void> {
  if ((await accountMenuTrigger(page).count()) > 0) await chooseLanguageInAccountMenu(page, language);
  else await chooseDisplayLanguage(page, language);
}

/** Opens the account menu → Language → the radio of `language`; leaves the menu closed. */
async function chooseLanguageInAccountMenu(page: Page, language: DocumentLang): Promise<void> {
  await accountMenuTrigger(page).click();
  await page.locator(`[data-testid="${ACCOUNT_LANGUAGE_TEST_ID}"]`).click();
  const option = page.locator(`[data-testid="${ACCOUNT_LANGUAGE_TEST_ID}-${language}"]`);
  if ((await option.getAttribute('aria-checked')) === 'true') {
    await closeMenus(page);
    return;
  }
  const saved = page.waitForResponse(isSettingsSave);
  await option.click();
  await saved;
  await closeMenus(page);
}

/** Menus nest no deeper than the account menu's submenus. */
const MAX_MENU_LEVELS = 3;

/**
 * Radio rows keep the menu open, and Escape closes one level (the submenu first), so it is pressed until none is left,
 * each time waiting until that level has closed.
 */
export async function closeMenus(page: Page): Promise<void> {
  const menus = page.getByRole('menu');
  for (let level = 0; level < MAX_MENU_LEVELS; level += 1) {
    const open = await menus.count();
    if (open === 0) break;
    // Escape only reaches the menu while focus is inside it; a language change re-renders the app and can drop focus
    // to the body, after which Escape closes nothing (#221). Focus the innermost open menu first.
    await menus.last().focus();
    await page.keyboard.press('Escape');
    await page.waitForFunction((before: number) => document.querySelectorAll('[role="menu"]').length < before, open);
  }
  await menus.first().waitFor({ state: 'detached' });
}

async function chooseDisplayLanguage(page: Page, language: DocumentLang): Promise<void> {
  await userMenuTrigger(page).click();
  await page.getByRole('menu').getByRole('button', { name: DASHBOARD_LABELS.languageItem }).click();
  const displayLanguage = page.getByRole('dialog').getByRole('combobox').first();
  const optionName = new RegExp(`^${language}\\s`);
  if (optionName.test((await displayLanguage.textContent()) ?? '')) {
    await page.keyboard.press('Escape');
    return;
  }
  const saved = page.waitForResponse(isSettingsSave);
  await displayLanguage.click();
  await page.getByRole('option', { name: optionName }).click();
  await saved;
  await page.keyboard.press('Escape');
}

/** Signs out through the account menu's Log out row, as a merchant does; resolves once the login page shows. */
export async function logOutThroughMenu(page: Page): Promise<void> {
  await accountMenuTrigger(page).click();
  await page.locator(`[data-testid="${ACCOUNT_LOGOUT_TEST_ID}"]`).click();
  await page.waitForURL((url) => url.pathname.endsWith('/login'));
}

/**
 * Signs out with the dashboard's own `logout` mutation. Clearing cookies alone leaves the token in
 * `localStorage`; the display language stays there, which is how the login page opens in it.
 */
export async function signOut(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await fetch('/admin-api', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { logout { success } }' }),
    });
    localStorage.removeItem('vendure-session-token');
  });
  await page.context().clearCookies();
}
