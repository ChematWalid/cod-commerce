import {
  ACCOUNT_LANGUAGE_TEST_ID,
  ACCOUNT_LOGOUT_TEST_ID,
  ACCOUNT_MENU_TEST_ID,
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_PROFILE_TEST_ID,
  ACCOUNT_SECURITY_PATH,
  ACCOUNT_SECURITY_TEST_ID,
  ACCOUNT_THEME_TEST_ID,
  accountOptionTestId,
  ASSISTANT_PLACEHOLDER_TEST_ID,
  CREDITS_PLACEHOLDER_TEST_ID,
  MERCHANT_NOT_FOUND_TEST_ID,
  NOTIFICATIONS_PLACEHOLDER_TEST_ID,
  STORE_SWITCHER_TEST_ID,
  TRIAL_BANNER_TEST_ID,
} from '@cod/plugin-merchant-shell';
import { ASSISTANT_NAME } from '@cod/shared';
import { type Browser, type BrowserContext, chromium, type Page, type Request } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import {
  assertNoPageError,
  loginAsDemoOwner,
  loginAsSuperadmin,
  logOutThroughMenu,
  setDisplayLanguage,
} from './dashboard-session';

const MOBILE_VIEWPORT = { width: 390, height: 844 };
const ROW_IDS = [
  ACCOUNT_PROFILE_TEST_ID,
  ACCOUNT_SECURITY_TEST_ID,
  ACCOUNT_LANGUAGE_TEST_ID,
  ACCOUNT_THEME_TEST_ID,
  ACCOUNT_LOGOUT_TEST_ID,
];
/** The stock user menu's trigger in the sidebar footer; the shell hides it from merchants (D79). */
const STOCK_USER_MENU = '[data-sidebar="footer"] [data-sidebar="menu-button"]';
const PRICING_LINK = 'a[href*="pricing"]';

const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const dashboardPath = (path: string): string => `${new URL(DASHBOARD_URL).pathname}${path}`;

async function openMenu(page: Page): Promise<void> {
  await byTestId(page, ACCOUNT_MENU_TEST_ID).click();
  await page.getByRole('menu').waitFor();
}

/** Where the sidebar sits: its horizontal centre relative to the viewport's. */
function sidebarSide(page: Page): Promise<'left' | 'right'> {
  return page
    .locator('[data-sidebar="sidebar"]')
    .first()
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return box.left + box.width / 2 > window.innerWidth / 2 ? 'right' : 'left';
    });
}

describe('top bar and account menu', () => {
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
  });

  afterEach(async () => {
    await context.close();
  });

  describe('for a merchant', () => {
    beforeEach(async () => {
      await loginAsDemoOwner(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
      await open(page, '/home');
      await byTestId(page, ACCOUNT_MENU_TEST_ID).waitFor();
    });

    it('lists five rows and the Vendure notice, and no link to the vendor pricing page', async () => {
      await openMenu(page);

      for (const id of ROW_IDS) await expect(byTestId(page, id).isVisible()).resolves.toBe(true);
      await expect(page.getByRole('menu').locator('[data-vendure-branding]').isVisible()).resolves.toBe(true);
      await expect(page.locator(PRICING_LINK).count()).resolves.toBe(0);
      await expect(page.getByRole('menu').getByText('Plans').count()).resolves.toBe(0);
    });

    it.each([
      { row: ACCOUNT_PROFILE_TEST_ID, path: ACCOUNT_PROFILE_PATH },
      { row: ACCOUNT_SECURITY_TEST_ID, path: ACCOUNT_SECURITY_PATH },
    ])('opens $path from its row', async ({ row, path }) => {
      await openMenu(page);

      await byTestId(page, row).click();

      await page.waitForURL((url) => url.pathname === dashboardPath(path));
      await assertNoPageError(page);
    });

    it('offers only English and Arabic, and three themes', async () => {
      await openMenu(page);
      await byTestId(page, ACCOUNT_LANGUAGE_TEST_ID).click();
      const options = page.getByRole('menuitemradio');
      await options.first().waitFor();
      await expect(options.count()).resolves.toBe(2);
      await expect(byTestId(page, accountOptionTestId(ACCOUNT_LANGUAGE_TEST_ID, 'fr')).count()).resolves.toBe(0);
      await page.keyboard.press('Escape');

      await byTestId(page, ACCOUNT_THEME_TEST_ID).click();

      for (const theme of ['light', 'dark', 'system']) {
        await byTestId(page, accountOptionTestId(ACCOUNT_THEME_TEST_ID, theme)).waitFor({ state: 'visible' });
      }
    });

    it('applies the chosen theme', async () => {
      const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
      await openMenu(page);
      await byTestId(page, ACCOUNT_THEME_TEST_ID).click();
      await byTestId(page, accountOptionTestId(ACCOUNT_THEME_TEST_ID, 'dark')).click();
      await expect.poll(isDark).toBe(true);

      // The theme is stored with the user, so put it back for the next test.
      await byTestId(page, accountOptionTestId(ACCOUNT_THEME_TEST_ID, 'light')).click();
      await expect.poll(isDark).toBe(false);
    });

    it('switches to Arabic right to left with the sidebar on the right, and keeps it after a reload', async () => {
      await expect(sidebarSide(page)).resolves.toBe('left');

      await setDisplayLanguage(page, 'ar');

      await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('ar');
      await expect(sidebarSide(page)).resolves.toBe('right');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await byTestId(page, ACCOUNT_MENU_TEST_ID).waitFor();
      await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl');
      expect(await page.evaluate(() => document.documentElement.lang)).toBe('ar');
      await expect(sidebarSide(page)).resolves.toBe('right');
      await setDisplayLanguage(page, 'en');
    });

    it('logs out to the login page, stays signed out after a reload, and ends only this session', async () => {
      const second = await browser.newContext();
      const secondPage = await second.newPage();
      await loginAsDemoOwner(secondPage, DASHBOARD_URL);

      await logOutThroughMenu(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await open(page, '/home');

      await page.waitForURL((url) => url.pathname.endsWith('/login'));
      await open(secondPage, '/home');
      await byTestId(secondPage, ACCOUNT_MENU_TEST_ID).waitFor();
      expect(pathOf(secondPage)).toBe(dashboardPath('/home'));
      await second.close();
    });

    it('renders the placeholders, and clicking them sends no request', async () => {
      const requests: Request[] = [];
      await byTestId(page, TRIAL_BANNER_TEST_ID).waitFor();
      page.on('request', (request) => requests.push(request));

      for (const id of [
        CREDITS_PLACEHOLDER_TEST_ID,
        ASSISTANT_PLACEHOLDER_TEST_ID,
        NOTIFICATIONS_PLACEHOLDER_TEST_ID,
      ]) {
        await expect(byTestId(page, id).isVisible()).resolves.toBe(true);
        await byTestId(page, id).click({ force: true });
      }
      await byTestId(page, TRIAL_BANNER_TEST_ID).click();

      expect(await byTestId(page, ASSISTANT_PLACEHOLDER_TEST_ID).innerText()).toContain(ASSISTANT_NAME);
      expect(await byTestId(page, TRIAL_BANNER_TEST_ID).innerText()).not.toMatch(/\d/);
      expect(await byTestId(page, CREDITS_PLACEHOLDER_TEST_ID).innerText()).not.toMatch(/\d/);
      await page.waitForTimeout(500);
      expect(requests.map((request) => request.url())).toEqual([]);
    });

    it('orders the top bar credits, assistant, store switcher, bell, account', async () => {
      const selectors = [
        `[data-testid="${CREDITS_PLACEHOLDER_TEST_ID}"]`,
        `[data-testid="${ASSISTANT_PLACEHOLDER_TEST_ID}"]`,
        `[data-testid="${STORE_SWITCHER_TEST_ID}"]`,
        `[data-testid="${NOTIFICATIONS_PLACEHOLDER_TEST_ID}"]`,
        `[data-testid="${ACCOUNT_MENU_TEST_ID}"]`,
      ];
      for (const selector of selectors) await page.locator(selector).waitFor({ state: 'visible' });

      const lefts = await page.evaluate(
        (all) => all.map((selector) => document.querySelector(selector)?.getBoundingClientRect().left ?? Number.NaN),
        selectors,
      );

      expect(lefts.every((left) => !Number.isNaN(left))).toBe(true);
      expect(lefts).toEqual([...lefts].sort((a, b) => a - b));
    });

    it('hides the stock user menu and the trial banner stays off a not-found page', async () => {
      await expect(page.locator(STOCK_USER_MENU).count()).resolves.toBe(1);
      await expect(page.locator(STOCK_USER_MENU).isVisible()).resolves.toBe(false);

      await open(page, '/orders');

      await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
      await expect(byTestId(page, TRIAL_BANNER_TEST_ID).count()).resolves.toBe(0);
    });

    it('hides credits and the assistant below the sm breakpoint, and keeps the rest', async () => {
      await page.setViewportSize(MOBILE_VIEWPORT);

      await expect(byTestId(page, CREDITS_PLACEHOLDER_TEST_ID).isVisible()).resolves.toBe(false);
      await expect(byTestId(page, ASSISTANT_PLACEHOLDER_TEST_ID).isVisible()).resolves.toBe(false);
      await expect(byTestId(page, NOTIFICATIONS_PLACEHOLDER_TEST_ID).isVisible()).resolves.toBe(true);
      await expect(byTestId(page, ACCOUNT_MENU_TEST_ID).isVisible()).resolves.toBe(true);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });

  describe('for platform staff', () => {
    it('keeps the stock user menu and shows no account menu or merchant placeholders', async () => {
      await loginAsSuperadmin(page, DASHBOARD_URL);
      await open(page, '/');
      await page.locator(STOCK_USER_MENU).waitFor();

      await expect(page.locator(STOCK_USER_MENU).isVisible()).resolves.toBe(true);
      await expect(byTestId(page, ACCOUNT_MENU_TEST_ID).count()).resolves.toBe(0);
      await expect(byTestId(page, NOTIFICATIONS_PLACEHOLDER_TEST_ID).count()).resolves.toBe(0);
      await expect(byTestId(page, TRIAL_BANNER_TEST_ID).count()).resolves.toBe(0);
    });
  });
});
