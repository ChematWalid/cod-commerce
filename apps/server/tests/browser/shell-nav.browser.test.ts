import {
  MERCHANT_NOT_FOUND_TEST_ID,
  SHELL_FORBIDDEN_TEST_ID,
  SHELL_SKELETON_TEST_ID,
} from '@cod/plugin-merchant-shell';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import {
  assertNoPageError,
  DEMO_OWNER_EMAIL,
  loginAsDemoOwner,
  loginAsOwner,
  loginAsSuperadmin,
  setDisplayLanguage,
} from './dashboard-session';
import { MERCHANT_SECTIONS, SKELETON_LEAVES } from './shell-nav-fixtures';

const NO_VIEW_MEMBER_EMAIL = 'noview@demo.example.test';
const PER_STORE_MEMBER_EMAIL = 'perstore@demo.example.test';
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
const SIDEBAR_ENTRIES = '[data-sidebar="content"] [data-sidebar="menu-button"]';
const VISIBLE_SIDEBAR = '[data-sidebar="sidebar"]';
const SIDEBAR_HEADER = '[data-sidebar="header"]';
const SIDEBAR_FOOTER = '[data-sidebar="footer"]';
/** The framework's name; only the licence notice (`[data-vendure-branding]`) may show it (ADR 0007). */
const VENDOR_NAME = /vendure/i;
const LICENCE_NOTICE = '[data-vendure-branding]';
const EVERY_LEAF_TIMEOUT_MS = 150_000;

const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const dashboardPath = (path: string): string => `${new URL(DASHBOARD_URL).pathname}${path}`;
const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });

async function sidebarEntries(page: Page): Promise<string[]> {
  await page.locator(SIDEBAR_ENTRIES).first().waitFor();
  return (await page.locator(SIDEBAR_ENTRIES).allInnerTexts()).map((text) => text.trim());
}

interface StoreIds {
  readonly id: string;
  readonly channelId: string;
}

/** The caller's two stores, in id order, through the query the shell itself reads. */
async function ownStores(page: Page): Promise<readonly [StoreIds, StoreIds]> {
  const stores = await page.evaluate(async (key: string) => {
    const response = await fetch('/admin-api', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
      body: JSON.stringify({ query: 'query { switchableStores { stores { id channelId } } }' }),
    });
    return ((await response.json()) as { data: { switchableStores: { stores: StoreIds[] } } }).data.switchableStores
      .stores;
  }, SELECTED_CHANNEL_KEY);
  const [first, second] = [...stores].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  if (first === undefined || second === undefined) throw new Error('the member should reach two stores');
  return [first, second];
}

/** The id of the channel the dashboard's stored token selects. */
const activeChannelId = (page: Page): Promise<string> =>
  page.evaluate(async (key: string) => {
    const response = await fetch('/admin-api', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
      body: JSON.stringify({ query: 'query { activeChannel { id } }' }),
    });
    return ((await response.json()) as { data: { activeChannel: { id: string } } }).data.activeChannel.id;
  }, SELECTED_CHANNEL_KEY);

const expectActive = (page: Page, channelId: string) => expect.poll(() => activeChannelId(page)).toBe(channelId);

/** Records, from before the page's own scripts run, whether `testId` is ever in the DOM. */
const watchFor = (page: Page, testId: string): Promise<unknown> =>
  page.addInitScript((id: string) => {
    const seen = (): void => {
      if (document.querySelector(`[data-testid="${id}"]`)) {
        (window as unknown as { __seen?: boolean }).__seen = true;
      }
    };
    new MutationObserver(seen).observe(document, { childList: true, subtree: true });
  }, testId);

/** The page's rendered text (`innerText`, so hidden parts are left out), without the elements matching `excluded`. */
const textOutside = (page: Page, excluded: string): Promise<string> =>
  page.evaluate((selector: string) => {
    const elements = [...document.querySelectorAll<HTMLElement>(selector)];
    const displays = elements.map((element) => element.style.display);
    elements.forEach((element) => {
      element.style.display = 'none';
    });
    const text = document.body.innerText;
    elements.forEach((element, index) => {
      element.style.display = displays[index] ?? '';
    });
    return text;
  }, excluded);

const everSeen = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as unknown as { __seen?: boolean }).__seen === true);

describe('merchant shell navigation', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await (await browser.newContext()).newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  describe('as the owner', () => {
    beforeEach(async () => {
      await loginAsDemoOwner(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
    });

    it('shows the merchant sections in tree order and never the Administration heading', async () => {
      await expect(sidebarEntries(page)).resolves.toEqual(MERCHANT_SECTIONS);
      await expect(page.locator(VISIBLE_SIDEBAR).getByText('Administration').count()).resolves.toBe(0);
    });

    it('hides the stock sidebar header and footer', async () => {
      await page.locator(SIDEBAR_ENTRIES).first().waitFor();
      for (const part of [SIDEBAR_HEADER, SIDEBAR_FOOTER]) {
        // Present first, so a renamed attribute fails here instead of passing as "hidden".
        await expect(page.locator(part).count(), part).resolves.toBeGreaterThanOrEqual(1);
        await expect(page.locator(part).first().isVisible(), part).resolves.toBe(false);
      }
    });

    it(
      'renders every leaf URL with no alert',
      async () => {
        for (const path of SKELETON_LEAVES) {
          await open(page, path);
          await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
          expect(pathOf(page), path).toBe(dashboardPath(path));
          await expect(byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).count(), path).resolves.toBe(0);
          await assertNoPageError(page);
          expect(await textOutside(page, LICENCE_NOTICE), path).not.toMatch(VENDOR_NAME);
        }
      },
      EVERY_LEAF_TIMEOUT_MS,
    );

    it('shows not found on a stock page and renders no order table', async () => {
      await open(page, '/orders');
      await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
      await expect(page.locator('table').count()).resolves.toBe(0);
    });

    it('lands on Home from the root', async () => {
      await open(page, '/');
      await page.waitForURL(`**${dashboardPath('/home')}`);
      await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
    });

    it('sends the stock profile to the account profile', async () => {
      await open(page, '/profile');
      await page.waitForURL(`**${dashboardPath('/account/profile')}`);
      await assertNoPageError(page);
    });

    it('shows not found on an unknown URL and stays there', async () => {
      await open(page, '/nonexistent');
      await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
      await page.waitForLoadState('networkidle');
      expect(pathOf(page)).toBe(dashboardPath('/nonexistent'));
    });

    it('still opens Roles, with a link to the activity log, and the activity log itself', async () => {
      await open(page, '/team/roles');
      const link = page.locator(`a[href$="/team/activity-log"]`);
      await link.waitFor();
      await assertNoPageError(page);
      await expect(byTestId(page, SHELL_SKELETON_TEST_ID).count()).resolves.toBe(0);
      await link.click();
      await page.waitForURL(`**${dashboardPath('/team/activity-log')}`);
      await assertNoPageError(page);
    });

    it.each(['/account/profile', '/account/security', '/team/activity-log'])(
      'keeps the extension route %s',
      async (path) => {
        await open(page, path);
        await page.locator('main h1, h1').first().waitFor();
        await assertNoPageError(page);
        await expect(byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).count()).resolves.toBe(0);
        expect(pathOf(page)).toBe(dashboardPath(path));
      },
    );
  });

  describe('signing in', () => {
    it('lands the owner on Home', async () => {
      await loginAsDemoOwner(page, DASHBOARD_URL);
      await page.waitForURL(`**${dashboardPath('/home')}`);
    });

    it('returns a deep link after the login redirect', async () => {
      await open(page, '/team/roles');
      await page.waitForURL(/\/login/);
      await page.getByRole('textbox', { name: 'Email' }).fill(DEMO_OWNER_EMAIL);
      await page.getByRole('textbox', { name: 'Password' }).fill(process.env['DEMO_OWNER_PASSWORD'] ?? '');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForURL(`**${dashboardPath('/team/roles')}`);
    });
  });

  describe('as a member with no view key', () => {
    beforeEach(async () => {
      await loginAsOwner(page, DASHBOARD_URL, NO_VIEW_MEMBER_EMAIL);
      await setDisplayLanguage(page, 'en');
    });

    it('shows Home alone and no empty group', async () => {
      await expect(sidebarEntries(page)).resolves.toEqual(['Home']);
    });

    it('shows forbidden on a direct leaf URL', async () => {
      await open(page, '/cod-orders');
      await byTestId(page, SHELL_FORBIDDEN_TEST_ID).waitFor();
    });
  });

  describe('as a member whose role differs per store', () => {
    it('is forbidden on the store without the key, which becomes active', async () => {
      await loginAsOwner(page, DASHBOARD_URL, PER_STORE_MEMBER_EMAIL);
      const [first, second] = await ownStores(page);
      await open(page, `/stores/${first.id}/products`);
      await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
      await expectActive(page, first.channelId);

      await open(page, `/stores/${second.id}/products`);

      await byTestId(page, SHELL_FORBIDDEN_TEST_ID).waitFor();
      await expectActive(page, second.channelId);
    });

    it('renders the store with the key from a deep link, with no forbidden flash on the way', async () => {
      await loginAsOwner(page, DASHBOARD_URL, PER_STORE_MEMBER_EMAIL);
      const [first, second] = await ownStores(page);
      await open(page, `/stores/${second.id}/products`);
      await byTestId(page, SHELL_FORBIDDEN_TEST_ID).waitFor();
      await expectActive(page, second.channelId);
      await watchFor(page, SHELL_FORBIDDEN_TEST_ID);

      await open(page, `/stores/${first.id}/products`);

      await byTestId(page, SHELL_SKELETON_TEST_ID).waitFor();
      await expectActive(page, first.channelId);
      await expect(everSeen(page)).resolves.toBe(false);
    });

    it('shows not found for a store outside the switchable list', async () => {
      await loginAsOwner(page, DASHBOARD_URL, PER_STORE_MEMBER_EMAIL);
      await open(page, '/stores/999999/products');
      await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();
    });
  });

  describe('as the superadmin', () => {
    it('keeps the stock sections and has no merchant tree', async () => {
      await loginAsSuperadmin(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
      await page.locator(SIDEBAR_FOOTER).waitFor();
      const entries = await sidebarEntries(page);
      expect(entries).toContain('Sales');
      await page.getByRole('button', { name: 'Sales' }).click();
      await page.locator(`${VISIBLE_SIDEBAR} a[href$="/orders"]`).waitFor();
      for (const merchantOnly of ['Home', 'Tracking', 'Delivery & shipping', 'Sourcing']) {
        expect(entries).not.toContain(merchantOnly);
      }
    });
  });
});
