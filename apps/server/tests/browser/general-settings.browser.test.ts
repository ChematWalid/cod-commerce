import {
  BUSINESS_LOGO_INPUT_TEST_ID,
  BUSINESS_LOGO_TEST_ID,
  BUSINESS_NAME_TEST_ID,
  BUSINESS_SAVE_TEST_ID,
  SETTINGS_ERROR_TEST_ID,
  STORE_CARD_TEST_ID,
  STORE_DESCRIPTION_TEST_ID,
  STORE_NAME_TEST_ID,
  STORE_SAVE_TEST_ID,
  STORE_SWITCHER_TEST_ID,
  soldOutOptionTestId,
} from '@cod/plugin-merchant-shell';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { storeUserSettings } from './account-menu-fixtures';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import {
  adminApi,
  archiveStore,
  byTestId,
  chooseStore,
  createDisposableStore,
  expectSwitcherOn,
  switchableStores,
} from './store-switcher-fixtures';

const SETTINGS_VIEWER_EMAIL = 'settingsview@demo.example.test';
const PHONE = { width: 390, height: 844 } as const;
/** One more than the server accepts, so the refusal comes from the server and not from this page. */
const OVER_LONG_NAME = 'x'.repeat(256);
const NAME_INVALID_ENGLISH = 'Enter a name of up to 255 characters.';
const ARABIC_BUSINESS_NAME_LABEL = 'اسم النشاط';

/** A one-pixel PNG: the smallest image the logo upload accepts. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const runId = Date.now().toString(36);
let sequence = 0;
const uniqueSubdomain = (): string => `gs${runId}${String(++sequence)}`;

const openSettings = async (page: Page): Promise<void> => {
  await page.goto(`${DASHBOARD_URL}/settings`, { waitUntil: 'domcontentloaded' });
  await byTestId(page, BUSINESS_NAME_TEST_ID).waitFor();
};
const value = (page: Page, testId: string): Promise<string> => byTestId(page, testId).inputValue();
const hasHorizontalOverflow = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

/** The first error of a raw Admin API call, which the shared helper would throw instead. */
const refusalCode = (page: Page, query: string): Promise<string | null> =>
  page.evaluate(async (document: string) => {
    const response = await fetch('/admin-api', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'vendure-token': localStorage.getItem('vendure-selected-channel-token') ?? '',
      },
      body: JSON.stringify({ query: document }),
    });
    const body = (await response.json()) as { errors?: { extensions?: { code?: string } }[] };
    return body.errors?.[0]?.extensions?.code ?? null;
  }, query);

describe('general settings', () => {
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
    await loginAsDemoOwner(page, DASHBOARD_URL);
  });

  afterEach(async () => {
    await context.close();
  });

  it('renames a store and shows the new name in the switcher after saving', async () => {
    const subdomain = uniqueSubdomain();
    const store = await createDisposableStore(page, { name: `Before ${runId}`, subdomain, language: 'ar' });
    disposable.push(store.id);
    await page.goto(`${DASHBOARD_URL}/home`, { waitUntil: 'domcontentloaded' });
    await chooseStore(page, subdomain);
    await expectSwitcherOn(page, subdomain);
    await openSettings(page);
    await expect.poll(() => value(page, STORE_NAME_TEST_ID)).toBe(`Before ${runId}`);
    await expect(byTestId(page, STORE_SAVE_TEST_ID).isDisabled()).resolves.toBe(true);

    await byTestId(page, STORE_NAME_TEST_ID).fill(`After ${runId}`);
    await byTestId(page, STORE_DESCRIPTION_TEST_ID).fill('Shoes and bags');
    await byTestId(page, STORE_SAVE_TEST_ID).click();

    await expect.poll(() => byTestId(page, STORE_SWITCHER_TEST_ID).innerText()).toContain(`After ${runId}`);
    const saved = (await switchableStores(page)).find((row) => row.id === store.id);
    expect(saved?.name).toBe(`After ${runId}`);
    await page.reload();
    await byTestId(page, STORE_NAME_TEST_ID).waitFor();
    await expect.poll(() => value(page, STORE_DESCRIPTION_TEST_ID)).toBe('Shoes and bags');
  });

  it('renames the business and keeps the name across a reload', async () => {
    await openSettings(page);
    const original = await value(page, BUSINESS_NAME_TEST_ID);
    const renamed = `${original} ${runId}`;
    try {
      await byTestId(page, BUSINESS_NAME_TEST_ID).fill(renamed);
      await byTestId(page, BUSINESS_SAVE_TEST_ID).click();
      await expect.poll(() => byTestId(page, BUSINESS_SAVE_TEST_ID).isDisabled()).toBe(true);

      await page.reload();
      await byTestId(page, BUSINESS_NAME_TEST_ID).waitFor();

      await expect.poll(() => value(page, BUSINESS_NAME_TEST_ID)).toBe(renamed);
    } finally {
      await adminApi(page, 'mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id } }', {
        input: { name: original },
      });
    }
  });

  it('shows the business logo after upload', async () => {
    const before = await adminApi<{ activeBusiness: { logoAssetId: string | null } }>(
      page,
      'query { activeBusiness { logoAssetId } }',
    );
    try {
      await openSettings(page);

      await byTestId(page, BUSINESS_LOGO_INPUT_TEST_ID).setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: ONE_PIXEL_PNG,
      });
      await expect.poll(() => byTestId(page, BUSINESS_SAVE_TEST_ID).isEnabled()).toBe(true);
      await byTestId(page, BUSINESS_SAVE_TEST_ID).click();
      await expect.poll(() => byTestId(page, BUSINESS_SAVE_TEST_ID).isDisabled()).toBe(true);
      await page.reload();
      await byTestId(page, BUSINESS_LOGO_TEST_ID).waitFor();

      const logo = byTestId(page, BUSINESS_LOGO_TEST_ID);
      await expect(logo.getAttribute('src')).resolves.toContain('preview/');
      await expect
        .poll(() =>
          logo.evaluate(
            (image) => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
    } finally {
      await adminApi(page, 'mutation ($input: UpdateBusinessInput!) { updateBusiness(input: $input) { id } }', {
        input: { logoAssetId: before.activeBusiness.logoAssetId },
      });
    }
  });

  it('saves sold-out hide and keeps it after reload', async () => {
    const subdomain = uniqueSubdomain();
    const store = await createDisposableStore(page, { name: `Sold out ${runId}`, subdomain, language: 'ar' });
    disposable.push(store.id);
    await page.goto(`${DASHBOARD_URL}/home`, { waitUntil: 'domcontentloaded' });
    await chooseStore(page, subdomain);
    await expectSwitcherOn(page, subdomain);
    await openSettings(page);
    const hide = byTestId(page, soldOutOptionTestId('hide'));
    await expect.poll(() => byTestId(page, soldOutOptionTestId('keep')).getAttribute('aria-checked')).toBe('true');

    await hide.click();
    await byTestId(page, STORE_SAVE_TEST_ID).click();
    await expect.poll(() => byTestId(page, STORE_SAVE_TEST_ID).isDisabled()).toBe(true);
    await page.reload();
    await byTestId(page, STORE_NAME_TEST_ID).waitFor();

    await expect.poll(() => byTestId(page, soldOutOptionTestId('hide')).getAttribute('aria-checked')).toBe('true');
    const saved = await adminApi<{ store: { soldOutBehavior: string } }>(
      page,
      'query ($id: String!) { store(id: $id) { soldOutBehavior } }',
      { id: store.id },
    );
    expect(saved.store.soldOutBehavior).toBe('hide');
  });

  it("shows the server's refusal by its catalogue sentence", async () => {
    await setDisplayLanguage(page, 'en');
    await openSettings(page);

    await byTestId(page, BUSINESS_NAME_TEST_ID).fill(OVER_LONG_NAME);
    await byTestId(page, BUSINESS_SAVE_TEST_ID).click();

    await expect.poll(() => byTestId(page, SETTINGS_ERROR_TEST_ID).innerText()).toBe(NAME_INVALID_ENGLISH);
  });

  it('switching store reloads the store card with the other store’s values', async () => {
    await openSettings(page);
    const [first, second] = (await switchableStores(page)).filter((row) => row.subdomain.startsWith('demo'));
    if (first === undefined || second === undefined) throw new Error('the demo owner has two stores');
    const shown = async (): Promise<string> => value(page, STORE_NAME_TEST_ID);
    await expect.poll(shown).not.toBe('');
    const current = (await shown()) === first.name ? first : second;
    const other = current === first ? second : first;

    await chooseStore(page, other.subdomain);

    await expect.poll(shown).toBe(other.name);
    await expectSwitcherOn(page, other.subdomain);
  });

  describe('as a member who may see the settings and change none', () => {
    beforeEach(async () => {
      await context.close();
      context = await browser.newContext();
      page = await context.newPage();
      await loginAsOwner(page, DASHBOARD_URL, SETTINGS_VIEWER_EMAIL);
    });

    it('shows both cards read-only, without a save button, and the server refuses a direct call', async () => {
      await openSettings(page);
      await byTestId(page, STORE_CARD_TEST_ID).waitFor();

      await expect(byTestId(page, BUSINESS_NAME_TEST_ID).getAttribute('readonly')).resolves.not.toBeNull();
      await expect(byTestId(page, STORE_NAME_TEST_ID).getAttribute('readonly')).resolves.not.toBeNull();
      await expect(byTestId(page, STORE_DESCRIPTION_TEST_ID).getAttribute('readonly')).resolves.not.toBeNull();
      await expect(byTestId(page, STORE_CARD_TEST_ID).getByRole('combobox').isDisabled()).resolves.toBe(true);
      await expect(byTestId(page, BUSINESS_SAVE_TEST_ID).count()).resolves.toBe(0);
      await expect(byTestId(page, STORE_SAVE_TEST_ID).count()).resolves.toBe(0);
      await expect(refusalCode(page, 'mutation { updateBusiness(input: { name: "Nope" }) { id } }')).resolves.toBe(
        'FORBIDDEN',
      );
    });
  });

  it('lays out right to left at 390 px without overflow', async () => {
    try {
      await setDisplayLanguage(page, 'ar');
      await page.setViewportSize(PHONE);
      await openSettings(page);
      await byTestId(page, STORE_CARD_TEST_ID).waitFor();

      await expect(page.locator('html').getAttribute('dir')).resolves.toBe('rtl');
      await expect(page.getByLabel(ARABIC_BUSINESS_NAME_LABEL).count()).resolves.toBe(1);
      await expect(hasHorizontalOverflow(page)).resolves.toBe(false);
    } finally {
      // Through the Admin API, not the menu: a failure here must not leave the owner in Arabic for the next files (#221).
      await storeUserSettings(page, { displayLanguage: 'en' });
    }
  });
});
