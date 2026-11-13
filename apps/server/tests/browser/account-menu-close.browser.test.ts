import { ACCOUNT_LANGUAGE_TEST_ID, ACCOUNT_MENU_TEST_ID, accountOptionTestId } from '@cod/plugin-merchant-shell';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import { expectAccountMenuClosed, nudgePointerOnto, storeUserSettings, userSettings } from './account-menu-fixtures';
import { DASHBOARD_URL } from './dashboard-pages';
import { closeAccountMenu, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import { chooseTheme } from './shell-appearance-fixtures';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
/** The GraphQL mutation that stores the user settings, the display language included. */
const SAVE_SETTINGS_MUTATION = 'setSettingsStoreValue';

const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);

/**
 * Regression cases for #221: after a change made in the account menu, the menu closes completely, whatever the viewport,
 * the direction the change flips the page to, and where the pointer was left.
 */
describe('closing the account menu after a change (#221)', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await storeUserSettings(page, { displayLanguage: 'en' });
    await page.goto(`${DASHBOARD_URL}/home`, { waitUntil: 'domcontentloaded' });
    await byTestId(page, ACCOUNT_MENU_TEST_ID).waitFor();
  });

  afterEach(async () => {
    try {
      await storeUserSettings(page, { displayLanguage: 'en' });
    } finally {
      await context.close();
    }
  });

  it('closes after Arabic to English at 390 px with the pointer left on the Language row', async () => {
    await setDisplayLanguage(page, 'ar');
    await page.setViewportSize(MOBILE_VIEWPORT);
    await byTestId(page, ACCOUNT_MENU_TEST_ID).click();
    await byTestId(page, ACCOUNT_LANGUAGE_TEST_ID).click();
    const saved = page.waitForResponse(
      (response) => response.request().postData()?.includes(SAVE_SETTINGS_MUTATION) ?? false,
    );
    await byTestId(page, accountOptionTestId(ACCOUNT_LANGUAGE_TEST_ID, 'en')).click();
    await saved;
    await page.waitForFunction(() => document.documentElement.dir === 'ltr');
    await nudgePointerOnto(page, `[data-testid="${ACCOUNT_LANGUAGE_TEST_ID}"]`);

    await closeAccountMenu(page, 'ltr');

    await expectAccountMenuClosed(page, 'ltr');
  });

  it('closes after English to Arabic at 390 px', async () => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    await setDisplayLanguage(page, 'ar');

    await expectAccountMenuClosed(page, 'rtl');
  });

  it('closes after a theme change at 390 px', async () => {
    const { theme } = await userSettings(page);
    await page.setViewportSize(MOBILE_VIEWPORT);
    try {
      await chooseTheme(page, theme === 'dark' ? 'light' : 'dark');

      await expectAccountMenuClosed(page, 'ltr');
    } finally {
      await storeUserSettings(page, { theme });
    }
  });

  it('closes after Arabic to English on a desktop', async () => {
    await setDisplayLanguage(page, 'ar');

    await setDisplayLanguage(page, 'en');

    await expectAccountMenuClosed(page, 'ltr');
  });
});
