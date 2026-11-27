import {
  BUSINESS_NAME_TEST_ID,
  SETTINGS_ERROR_TEST_ID,
  STORE_CARD_TEST_ID,
  STORE_FEE_GROUP_TEST_ID,
  STORE_NAME_TEST_ID,
  STORE_SAVE_TEST_ID,
} from '@cod/plugin-merchant-shell';
import { WILAYA_CODES } from '@cod/shared';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import {
  adminApi,
  archiveStore,
  byTestId,
  chooseStore,
  createDisposableStore,
  expectSwitcherOn,
} from './store-switcher-fixtures';

const SETTINGS_VIEWER_EMAIL = 'settingsview@demo.example.test';
const REFERENCE_GONE_ENGLISH = 'This delivery option no longer exists. Choose another one.';

const CREATE_FEE_GROUP = `mutation ($input: DeliveryFeeGroupInput!) { createDeliveryFeeGroup(input: $input) { id } }`;
const DELETE_FEE_GROUP = 'mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }';
const STORE_DEFAULT_FEE_GROUP = 'query ($id: String!) { store(id: $id) { defaultDeliveryFeeGroupId } }';

const runId = Date.now().toString(36);
let sequence = 0;
const uniqueSubdomain = (): string => `fg${runId}${String(++sequence)}`;

const openSettings = async (page: Page): Promise<void> => {
  await page.goto(`${DASHBOARD_URL}/settings`, { waitUntil: 'domcontentloaded' });
  await byTestId(page, BUSINESS_NAME_TEST_ID).waitFor();
};

/** Creates a pricing option on the store the session is on, every wilaya at the same prices, and answers its id. */
async function createFeeGroup(page: Page, name: string): Promise<string> {
  const rates = WILAYA_CODES.map((provinceCode) => ({
    provinceCode,
    homePrice: 700,
    deskPrice: 400,
    deliveryEnabled: true,
    deskEnabled: true,
  }));
  const input = { name, chargeOverweight: false, overweightAllowanceKg: 0, overweightRate: 0, rates };
  const created = await adminApi<{ createDeliveryFeeGroup: { id: string } }>(page, CREATE_FEE_GROUP, { input });
  return created.createDeliveryFeeGroup.id;
}

/** Picks the pricing option named `name` in the store card's Default pricing option select. */
async function chooseFeeGroup(page: Page, name: string): Promise<void> {
  await byTestId(page, STORE_FEE_GROUP_TEST_ID).click();
  await page.getByRole('option', { name }).click();
}

const storeDefault = async (page: Page, storeId: string): Promise<string | null> =>
  (
    await adminApi<{ store: { defaultDeliveryFeeGroupId: string | null } }>(page, STORE_DEFAULT_FEE_GROUP, {
      id: storeId,
    })
  ).store.defaultDeliveryFeeGroupId;

describe('store settings: default pricing option (issue 207)', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  const disposable: string[] = [];

  /** Opens a new store of the demo owner and puts the session on it, so pricing options are created there. */
  async function onNewStore(name: string): Promise<string> {
    const subdomain = uniqueSubdomain();
    const store = await createDisposableStore(page, { name, subdomain, language: 'ar' });
    disposable.push(store.id);
    await page.goto(`${DASHBOARD_URL}/home`, { waitUntil: 'domcontentloaded' });
    await chooseStore(page, subdomain);
    await expectSwitcherOn(page, subdomain);
    return store.id;
  }

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
    await setDisplayLanguage(page, 'en');
  });

  afterEach(async () => {
    await context.close();
  });

  it('saves another pricing option as the store default and keeps it after reload', async () => {
    const storeId = await onNewStore(`Fee group ${runId}`);
    const name = `Summer ${runId}`;
    const groupId = await createFeeGroup(page, name);
    await openSettings(page);

    await chooseFeeGroup(page, name);
    await byTestId(page, STORE_SAVE_TEST_ID).click();
    await expect.poll(() => byTestId(page, STORE_SAVE_TEST_ID).isDisabled()).toBe(true);
    await page.reload();
    await byTestId(page, STORE_NAME_TEST_ID).waitFor();

    await expect.poll(() => byTestId(page, STORE_FEE_GROUP_TEST_ID).innerText()).toBe(name);
    await expect(storeDefault(page, storeId)).resolves.toBe(groupId);
  });

  it('shows the refusal of a pricing option deleted before the save by its catalogue sentence', async () => {
    const storeId = await onNewStore(`Gone ${runId}`);
    const name = `Short lived ${runId}`;
    const groupId = await createFeeGroup(page, name);
    await openSettings(page);
    await chooseFeeGroup(page, name);

    await adminApi(page, DELETE_FEE_GROUP, { id: groupId });
    await byTestId(page, STORE_SAVE_TEST_ID).click();

    await expect.poll(() => byTestId(page, SETTINGS_ERROR_TEST_ID).innerText()).toBe(REFERENCE_GONE_ENGLISH);
    await expect(storeDefault(page, storeId)).resolves.not.toBe(groupId);
  });

  describe('as a member who may see the settings but not the pricing options', () => {
    beforeEach(async () => {
      await context.close();
      context = await browser.newContext();
      page = await context.newPage();
      await loginAsOwner(page, DASHBOARD_URL, SETTINGS_VIEWER_EMAIL);
      await setDisplayLanguage(page, 'en');
    });

    it('says only whether a default is set, without a select to choose one', async () => {
      await openSettings(page);
      await byTestId(page, STORE_CARD_TEST_ID).waitFor();
      const field = byTestId(page, STORE_FEE_GROUP_TEST_ID);

      // Every store gets the platform default table as its default (D3112).
      await expect.poll(() => field.innerText()).toBe('Set');
      await expect(field.evaluate((element) => element.tagName)).resolves.toBe('P');
      await expect(byTestId(page, STORE_CARD_TEST_ID).getByRole('combobox').count()).resolves.toBe(1);
    });
  });
});
