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

/** The GraphQL mutation that stores the user settings, the display language included, on the server. */
const SAVE_SETTINGS_MUTATION = 'setSettingsStoreValue';

/** The superadmin of `.env` (`SUPERADMIN_*`), the only account in P0. */
function superadminCredentials(): { username: string; password: string } {
  const username = process.env['SUPERADMIN_USERNAME'];
  const password = process.env['SUPERADMIN_PASSWORD'];
  if (!username || !password) {
    throw new Error('SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD must be set (apps/server/.env)');
  }
  return { username, password };
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The sidebar's user menu trigger, named "<first> <last> <identifier>" (e.g. "Super Admin superadmin"). */
const userMenuTrigger = (page: Page): Locator =>
  page.getByRole('button', { name: new RegExp(`${escapeRegExp(superadminCredentials().username)}$`) });

/** Signs in on the dashboard login page and waits until the app shell has replaced it. */
export async function loginAsSuperadmin(page: Page, baseUrl: string): Promise<void> {
  const { username, password } = superadminCredentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByRole('textbox', { name: DASHBOARD_LABELS.email }).fill(username);
  await page.getByRole('textbox', { name: DASHBOARD_LABELS.password }).fill(password);
  await page.getByRole('button', { name: DASHBOARD_LABELS.signIn }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/login'));
  await userMenuTrigger(page).waitFor();
}

const isSettingsSave = (response: Response): boolean =>
  response.request().postData()?.includes(SAVE_SETTINGS_MUTATION) ?? false;

/**
 * Switches the display language through the user menu → Language dialog, as a user would, and waits until
 * the server has stored it. Writing `localStorage` alone does not stick: the server-stored user settings
 * overwrite it on the next load (spike A, ADR 0010). The options are matched by their language code
 * ("ar العربية", "en English"), which stays the same in every display language.
 */
export async function setDisplayLanguage(page: Page, language: DocumentLang): Promise<void> {
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
