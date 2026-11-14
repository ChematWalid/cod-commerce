import { PRODUCT_LIST_TEST_ID } from '@cod/plugin-catalog';
import { MERCHANT_NOT_FOUND_TEST_ID, STORE_SWITCHER_TEST_ID } from '@cod/plugin-merchant-shell';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, loginAsOwner } from './dashboard-session';
import {
  archiveStore,
  byTestId,
  chooseStore,
  createDisposableStore,
  expectSwitcherOn,
  foreignStore,
  memberAccess,
  ownAdministratorId,
  selectedToken,
  setSelectedStores,
  type StoreRow,
  switchableStores,
  switcherSubdomain,
  tokenChangesFrom,
} from './store-switcher-fixtures';

const LIMITED_MEMBER_EMAIL = 'limited@demo.example.test';
const ME_OPERATION = 'CurrentUserInformation';
const ACTIVE_CHANNEL_SELECTION = 'activeChannel {';
/** Long enough for a refresh loop, which runs at round-trip rate, to show. */
const RECOVERY_SETTLE_MS = 3_000;

const runId = Date.now().toString(36);
let sequence = 0;
/** A subdomain unique to this run and call. */
function uniqueSubdomain(): string {
  sequence += 1;
  return `sw${runId}${String(sequence)}`;
}

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const dashboardPath = (path: string): string => `${new URL(DASHBOARD_URL).pathname}${path}`;
const pathOf = (page: Page): string => new URL(page.url()).pathname;

describe('store switcher', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const disposable: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    const cleanup = await browser.newPage();
    await loginAsDemoOwner(cleanup, DASHBOARD_URL);
    for (const id of disposable) await archiveStore(cleanup, id);
    await browser.close();
  });

  beforeEach(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await context.close();
  });

  async function ownStores(): Promise<readonly [StoreRow, StoreRow]> {
    const [first, second] = await switchableStores(page);
    if (first === undefined || second === undefined) throw new Error('the demo owner has two stores');
    return [first, second];
  }

  it('lists the stores of the business and no store of another business', async () => {
    const foreign = await foreignStore(browser);
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const [first, second] = await ownStores();

    await byTestId(page, STORE_SWITCHER_TEST_ID).click();

    const menu = page.getByRole('menu');
    await expect.poll(() => menu.innerText()).toContain(first.subdomain);
    expect(await menu.innerText()).toContain(second.subdomain);
    expect(await menu.innerText()).not.toContain(foreign.subdomain);
    expect(await menu.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  });

  it('switching changes the channel token and survives a reload', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const [first, second] = await ownStores();
    await open(page, '/home');
    await byTestId(page, STORE_SWITCHER_TEST_ID).waitFor();
    const current = await switcherSubdomain(page);
    const target = current === first.subdomain ? second : first;
    const before = await selectedToken(page);

    await chooseStore(page, target.subdomain);

    await tokenChangesFrom(page, before);
    await expectSwitcherOn(page, target.subdomain);
    await page.reload();
    await expectSwitcherOn(page, target.subdomain);
  });

  it('switching on a store URL moves to the active alias and stays on the new store (Review Focus 3)', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const [first, second] = await ownStores();
    await open(page, `/stores/${first.id}/products`);
    await expectSwitcherOn(page, first.subdomain);

    await chooseStore(page, second.subdomain);

    await expect.poll(() => pathOf(page)).toBe(dashboardPath('/stores/active/products'));
    await expectSwitcherOn(page, second.subdomain);
    await assertNoPageError(page);
    expect(pathOf(page)).toBe(dashboardPath('/stores/active/products'));
    await expectSwitcherOn(page, second.subdomain);
    await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
  });

  it('a store of another business is not found and an own store switches', async () => {
    const foreign = await foreignStore(browser);
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const [first, second] = await ownStores();

    await open(page, `/stores/${foreign.id}/products`);
    await byTestId(page, MERCHANT_NOT_FOUND_TEST_ID).waitFor();

    await open(page, `/stores/${first.id}/products`);
    await expectSwitcherOn(page, first.subdomain);
    await open(page, `/stores/${second.id}/products`);
    await expectSwitcherOn(page, second.subdomain);
  });

  it('an archived active store moves the merchant to another store with no alert (Review Focus 1)', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const subdomain = uniqueSubdomain();
    const store = await createDisposableStore(page, { name: `Archive ${runId}`, subdomain, language: 'ar' });
    await open(page, '/home');
    await chooseStore(page, subdomain);
    await expectSwitcherOn(page, subdomain);
    await archiveStore(page, store.id);

    await page.reload();

    await expect.poll(async () => (await switchableStores(page)).some((row) => row.id === store.id)).toBe(false);
    await expect.poll(() => switcherSubdomain(page)).not.toBe(subdomain);
    await assertNoPageError(page);
  });

  it('losing the active store mid-session refreshes once and lands on the remaining store (Review Focus 2)', async () => {
    const owner = await browser.newContext();
    const ownerPage = await owner.newPage();
    await loginAsDemoOwner(ownerPage, DASHBOARD_URL);
    const firstStore = (await switchableStores(ownerPage)).find((row) => row.language === 'ar');
    if (firstStore === undefined) throw new Error('the demo owner has an Arabic store');
    // Same language as the first store: a content-language change would invalidate every query (stock behaviour).
    const secondStore = await createDisposableStore(ownerPage, {
      name: `Member ${runId}`,
      subdomain: uniqueSubdomain(),
      language: 'ar',
    });
    disposable.push(secondStore.id);
    await loginAsOwner(page, DASHBOARD_URL, LIMITED_MEMBER_EMAIL);
    const access = await memberAccess(ownerPage, await ownAdministratorId(page));
    await setSelectedStores(ownerPage, access, [firstStore.id, secondStore.id]);
    try {
      await page.reload();
      await expect.poll(async () => (await switchableStores(page)).length).toBe(2);
      await open(page, '/team/roles');
      await byTestId(page, STORE_SWITCHER_TEST_ID).locator('bdi[dir="ltr"]').waitFor();
      const activeToken = await selectedToken(page);
      const remaining = (await switcherSubdomain(page)) === firstStore.subdomain ? secondStore : firstStore;
      await page.evaluate(() => {
        (window as unknown as { __noReload?: boolean }).__noReload = true;
      });
      let meRequests = 0;
      page.on('request', (request) => {
        if (request.postData()?.includes(ME_OPERATION)) meRequests += 1;
      });

      await setSelectedStores(ownerPage, access, [remaining.id]);
      await page.locator('[data-sidebar="content"] a[href$="/home"]').first().click();

      await tokenChangesFrom(page, activeToken);
      await expectSwitcherOn(page, remaining.subdomain);
      await assertNoPageError(page);
      expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
      expect(meRequests).toBe(1);
    } finally {
      await setSelectedStores(ownerPage, access, access.storeIds);
      await owner.close();
    }
  });

  it('a persistently failing active channel refreshes exactly once', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    let meRequests = 0;
    await page.route(/\/admin-api/, async (route) => {
      const body = route.request().postData() ?? '';
      if (body.includes(ME_OPERATION)) meRequests += 1;
      if (!body.includes(ACTIVE_CHANNEL_SELECTION)) {
        await route.continue();
        return;
      }
      await route.fulfill({
        json: { errors: [{ message: 'refused', extensions: { code: 'FORBIDDEN' } }], data: null },
      });
    });

    await page.reload();

    // One for the page load and one for the single refresh.
    await expect.poll(() => meRequests).toBe(2);
    await page.waitForTimeout(RECOVERY_SETTLE_MS);
    expect(meRequests).toBe(2);
  });
});
