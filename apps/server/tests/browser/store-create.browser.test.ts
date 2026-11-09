import { CREATE_STORE_DIALOG_TEST_ID, STORE_CREATE_TEST_ID, STORE_SWITCHER_TEST_ID } from '@cod/plugin-merchant-shell';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import {
  archiveStore,
  byTestId,
  chooseStore,
  createDisposableStore,
  expectSwitcherOn,
  selectedToken,
  switchableStores,
  switcherSubdomain,
  tokenChangesFrom,
} from './store-switcher-fixtures';

const LIMITED_MEMBER_EMAIL = 'limited@demo.example.test';
const USER_SETTINGS_KEY = 'vendure-user-settings';
const ARABIC_TAKEN_TEXT = 'هذا العنوان مستخدم بالفعل';
const LONG_ARABIC_NAME = 'متجر'.repeat(15);
/** The dialog waits up to 10 s for the new store's channel (D87). */
const SWITCH_AFTER_CREATE_MS = 12_000;
const MOBILE_VIEWPORT = { width: 390, height: 844 };

const runId = Date.now().toString(36);
let sequence = 0;
/** A subdomain unique to this run and call. */
function uniqueSubdomain(): string {
  sequence += 1;
  return `sc${runId}${String(sequence)}`;
}

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });

describe('create store and store language', () => {
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

      await expect.poll(() => switcherSubdomain(page), { timeout: SWITCH_AFTER_CREATE_MS }).toBe(subdomain);
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
