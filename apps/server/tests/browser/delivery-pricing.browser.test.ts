import {
  ADD_PRICING_TEST_ID,
  APPLY_ALL_TEST_ID,
  APPLY_HOME_TEST_ID,
  CARRIERS_PLACEHOLDER_TEST_ID,
  COMMUNE_PANEL_TEST_ID,
  COMMUNE_ROW_TEST_ID,
  COMMUNES_SAVE_FIRST_TEST_ID,
  DELIVER_EVERYWHERE_TEST_ID,
  DELIVERY_TABS_TEST_ID,
  DESK_EVERYWHERE_TEST_ID,
  PRICING_BACK_TEST_ID,
  PRICING_EDITOR_TEST_ID,
  PRICING_LIST_TEST_ID,
  PRICING_NAME_TEST_ID,
  PRICING_ROW_TEST_ID,
  PRICING_SAVE_TEST_ID,
  WILAYA_ROW_TEST_ID,
} from '@cod/plugin-delivery-pricing';
import { WILAYA_COUNT } from '@cod/shared';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import { adminApi, byTestId } from './store-switcher-fixtures';

const runId = Date.now().toString(36);
const DELIVERY_PATH = '/delivery';
const NEW_PRICING_PATH = '/stores/active/delivery/pricing/new';
/** The editor URL a saved pricing option opens at; `new` is the create route, not an id. */
const SAVED_PRICING_URL = /\/stores\/[^/]+\/delivery\/pricing\/(?!new\b)([^/?#]+)$/;
/** The shell's permissions query, whose answer the page reads to show each tab. */
const PERMISSIONS_OPERATION = 'ShellEffectivePermissions';
const PHONE = { width: 375, height: 812 } as const;

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const wilayaRow = (page: Page, code: string) =>
  page.locator(`[data-testid="${WILAYA_ROW_TEST_ID}"][data-province-code="${code}"]`);
const homeInputs = (page: Page) =>
  byTestId(page, WILAYA_ROW_TEST_ID).getByRole('textbox', { name: 'Home delivery (DZD)' });
const switchesNamed = (page: Page, name: string) =>
  byTestId(page, WILAYA_ROW_TEST_ID).getByRole('switch', { name, exact: true });
const checkedCount = async (page: Page, name: string): Promise<number> =>
  (await switchesNamed(page, name).evaluateAll((all) => all.map((each) => each.getAttribute('aria-checked')))).filter(
    (state) => state === 'true',
  ).length;

/** Answers the permissions query without the `delivery.pricing.*` keys, as for a member holding only carriers. */
async function withoutPricingKeys(page: Page): Promise<void> {
  await page.route('**/admin-api**', async (route) => {
    if (!(route.request().postData() ?? '').includes(PERMISSIONS_OPERATION)) return route.fallback();
    const response = await route.fetch();
    const body = (await response.json()) as { data: { effectivePermissions: { permissions: string[] } } };
    const permissions = [
      ...body.data.effectivePermissions.permissions.filter((key) => !key.startsWith('delivery.pricing.')),
      'delivery.carriers.view',
    ];
    return route.fulfill({ response, json: { data: { effectivePermissions: { permissions } } } });
  });
}

describe('delivery pricing tab', () => {
  let browser: Browser;
  let page: Page;
  const groups: string[] = [];

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await (await browser.newContext()).newPage();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
  });

  afterEach(async () => {
    for (const id of groups.splice(0)) {
      await adminApi(page, 'mutation ($id: String!) { deleteDeliveryFeeGroup(id: $id) }', { id });
    }
    await page.context().close();
  });

  it('opens on Carriers, and the Delivery pricing tab lists the platform default table under ?tab=pricing', async () => {
    await open(page, DELIVERY_PATH);
    await byTestId(page, CARRIERS_PLACEHOLDER_TEST_ID).waitFor();

    await byTestId(page, DELIVERY_TABS_TEST_ID).getByRole('tab', { name: 'Delivery pricing' }).click();

    await page.waitForURL((url) => url.searchParams.get('tab') === 'pricing');
    await byTestId(page, PRICING_LIST_TEST_ID).waitFor();
    await expect.poll(() => byTestId(page, PRICING_ROW_TEST_ID).count()).toBeGreaterThan(0);
  });

  it('hides the pricing tab from a caller without delivery.pricing.view', async () => {
    await withoutPricingKeys(page);

    await open(page, `${DELIVERY_PATH}?tab=pricing`);

    await byTestId(page, CARRIERS_PLACEHOLDER_TEST_ID).waitFor();
    await expect(byTestId(page, DELIVERY_TABS_TEST_ID).getByRole('tab').allInnerTexts()).resolves.toEqual(['Carriers']);
    await expect(byTestId(page, PRICING_LIST_TEST_ID).count()).resolves.toBe(0);
  });

  it('applies the typed price to every wilaya and drives every row from the master toggles', async () => {
    await open(page, NEW_PRICING_PATH);
    await expect.poll(() => byTestId(page, WILAYA_ROW_TEST_ID).count()).toBe(WILAYA_COUNT);

    await byTestId(page, APPLY_HOME_TEST_ID).fill('650');
    await byTestId(page, APPLY_ALL_TEST_ID).click();
    await byTestId(page, DELIVER_EVERYWHERE_TEST_ID).click();

    expect(
      new Set(await homeInputs(page).evaluateAll((all) => all.map((each) => (each as HTMLInputElement).value))),
    ).toEqual(new Set(['650']));
    await expect(checkedCount(page, 'Delivery')).resolves.toBe(0);
    await byTestId(page, DELIVER_EVERYWHERE_TEST_ID).click();
    await byTestId(page, DESK_EVERYWHERE_TEST_ID).click();
    await expect(checkedCount(page, 'Delivery')).resolves.toBe(WILAYA_COUNT);
    await expect(checkedCount(page, 'Stop desk')).resolves.toBe(0);
  });

  it('asks a new option to be saved before its communes, then edits the communes once saved', async () => {
    await open(page, NEW_PRICING_PATH);
    await wilayaRow(page, '16').getByRole('button', { name: 'Communes' }).click();
    await byTestId(page, COMMUNES_SAVE_FIRST_TEST_ID).waitFor();

    await byTestId(page, PRICING_NAME_TEST_ID).fill(`Browser option ${runId}`);
    await byTestId(page, PRICING_SAVE_TEST_ID).click();
    await page.waitForURL(SAVED_PRICING_URL);
    const id = SAVED_PRICING_URL.exec(new URL(page.url()).pathname)?.[1];
    if (id !== undefined) groups.push(id);
    await wilayaRow(page, '16').getByRole('button', { name: 'Communes' }).click();

    await byTestId(page, COMMUNE_PANEL_TEST_ID).waitFor();
    await expect.poll(() => byTestId(page, COMMUNE_ROW_TEST_ID).count()).toBeGreaterThan(0);
  });

  it('stacks the wilaya rows on a phone without a sideways page scroll', async () => {
    await page.setViewportSize(PHONE);

    await open(page, NEW_PRICING_PATH);
    await byTestId(page, PRICING_EDITOR_TEST_ID).waitFor();
    await expect.poll(() => byTestId(page, WILAYA_ROW_TEST_ID).count()).toBe(WILAYA_COUNT);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(byTestId(page, ADD_PRICING_TEST_ID).count()).resolves.toBe(0);
  });

  it('keeps Back to pricing next to Save in the page header on a phone', async () => {
    await page.setViewportSize(PHONE);

    await open(page, NEW_PRICING_PATH);
    await byTestId(page, PRICING_EDITOR_TEST_ID).waitFor();

    await expect(byTestId(page, PRICING_SAVE_TEST_ID).isVisible()).resolves.toBe(true);
    await expect(byTestId(page, PRICING_BACK_TEST_ID).isVisible()).resolves.toBe(true);
    await byTestId(page, PRICING_BACK_TEST_ID).click();
    await byTestId(page, PRICING_LIST_TEST_ID).waitFor();
  });
});
