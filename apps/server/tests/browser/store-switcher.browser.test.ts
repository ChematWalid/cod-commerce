import {
  CREATE_STORE_DIALOG_TEST_ID,
  MERCHANT_NOT_FOUND_TEST_ID,
  STORE_CREATE_TEST_ID,
  STORE_SWITCHER_TEST_ID,
} from '@cod/plugin-merchant-shell';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import {
  archiveStore,
  createDisposableStore,
  memberAccess,
  ownAdministratorId,
  selectedToken,
  setSelectedStores,
  type StoreRow,
  switchableStores,
} from './store-switcher-fixtures';

const SECOND_BUSINESS_OWNER_EMAIL = 'owner@second.example.test';
const LIMITED_MEMBER_EMAIL = 'limited@demo.example.test';
const USER_SETTINGS_KEY = 'vendure-user-settings';
const ARABIC_TAKEN_TEXT = 'هذا العنوان مستخدم بالفعل';
const LONG_ARABIC_NAME = 'متجر'.repeat(15);
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const ME_OPERATION = 'CurrentUserInformation';

const runId = Date.now().toString(36);
let sequence = 0;
/** A subdomain unique to this run and call. */
function uniqueSubdomain(): string {
  sequence += 1;
  return `sw${runId}${String(sequence)}`;
}

const byTestId = (page: Page, id: string) => page.locator(`[data-testid="${id}"]`);
const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const dashboardPath = (path: string): string => `${new URL(DASHBOARD_URL).pathname}${path}`;
const pathOf = (page: Page): string => new URL(page.url()).pathname;

async function chooseStore(page: Page, subdomain: string): Promise<void> {
  await byTestId(page, STORE_SWITCHER_TEST_ID).click();
  await page.getByRole('menuitem', { name: new RegExp(`${subdomain}$`) }).click();
}

const switcherSubdomain = (page: Page): Promise<string> =>
  byTestId(page, STORE_SWITCHER_TEST_ID).locator('bdi[dir="ltr"]').innerText();

const expectSwitcherOn = (page: Page, subdomain: string) => expect.poll(() => switcherSubdomain(page)).toBe(subdomain);

const tokenChangesFrom = (page: Page, before: string | null) =>
  expect.poll(async () => selectedToken(page)).not.toBe(before);

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
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await loginAsOwner(otherPage, DASHBOARD_URL, SECOND_BUSINESS_OWNER_EMAIL);
    const [foreign] = await switchableStores(otherPage);
    await other.close();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const [first, second] = await ownStores();

    await byTestId(page, STORE_SWITCHER_TEST_ID).click();

    const menu = page.getByRole('menu');
    await expect.poll(() => menu.innerText()).toContain(first.subdomain);
    expect(await menu.innerText()).toContain(second.subdomain);
    expect(await menu.innerText()).not.toContain(foreign?.subdomain);
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
  });

  it('a store of another business is not found and an own store switches', async () => {
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await loginAsOwner(otherPage, DASHBOARD_URL, SECOND_BUSINESS_OWNER_EMAIL);
    const [foreign] = await switchableStores(otherPage);
    await other.close();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const [first, second] = await ownStores();

    await open(page, `/stores/${foreign?.id ?? ''}/products`);
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

  it('Create Store shows the Arabic refusal for a taken address, then creates and switches', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'ar');
    try {
      const before = await selectedToken(page);
      const subdomain = uniqueSubdomain();
      await byTestId(page, STORE_SWITCHER_TEST_ID).click();
      await byTestId(page, STORE_CREATE_TEST_ID).click();
      const dialog = byTestId(page, CREATE_STORE_DIALOG_TEST_ID);
      await dialog.getByRole('textbox').nth(0).fill(`Created ${runId}`);
      const address = dialog.getByRole('textbox').nth(1);

      await address.fill('demo');
      await dialog.getByText(ARABIC_TAKEN_TEXT).waitFor();

      await address.fill(subdomain);
      await expect.poll(() => dialog.locator('button[type="submit"]').isEnabled()).toBe(true);
      await dialog.locator('button[type="submit"]').click();

      await expectSwitcherOn(page, subdomain);
      await tokenChangesFrom(page, before);
      const created = (await switchableStores(page)).find((row) => row.subdomain === subdomain);
      if (created !== undefined) disposable.push(created.id);
    } finally {
      await setDisplayLanguage(page, 'en');
    }
  });

  it('hides Create Store from a member without the permission', async () => {
    await loginAsOwner(page, DASHBOARD_URL, LIMITED_MEMBER_EMAIL);
    await open(page, '/team/roles');
    await byTestId(page, STORE_SWITCHER_TEST_ID).click();
    await page.getByRole('menu').waitFor();

    expect(await byTestId(page, STORE_CREATE_TEST_ID).count()).toBe(0);
  });

  it('truncates a 60-character Arabic name with no horizontal overflow at 390 px (Review Focus 5)', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const subdomain = uniqueSubdomain();
    const store = await createDisposableStore(page, { name: LONG_ARABIC_NAME, subdomain, language: 'ar' });
    disposable.push(store.id);
    await setDisplayLanguage(page, 'ar');
    try {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await open(page, '/home');
      await chooseStore(page, subdomain);
      await expectSwitcherOn(page, subdomain);

      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      expect(fits).toBe(true);
      expect(await byTestId(page, STORE_SWITCHER_TEST_ID).locator('bdi[dir="ltr"]').innerText()).toBe(subdomain);
    } finally {
      await page.setViewportSize({ width: 1280, height: 800 });
      await setDisplayLanguage(page, 'en');
    }
  });

  it('a French store sets the content language to French with the sidebar closed on mobile', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    const subdomain = uniqueSubdomain();
    const store = await createDisposableStore(page, { name: `French ${runId}`, subdomain, language: 'fr' });
    disposable.push(store.id);
    await page.setViewportSize(MOBILE_VIEWPORT);
    await open(page, '/home');

    await chooseStore(page, subdomain);

    await expect
      .poll(() =>
        page.evaluate(
          (key) => (JSON.parse(localStorage.getItem(key) ?? '{}') as { contentLanguage?: string }).contentLanguage,
          USER_SETTINGS_KEY,
        ),
      )
      .toBe('fr');
    expect(store.language).toBe('fr');
  });
});
