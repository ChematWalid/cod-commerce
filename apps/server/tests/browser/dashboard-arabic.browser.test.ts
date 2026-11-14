import { PRODUCT_LIST_TEST_ID } from '@cod/plugin-catalog';
import { BUSINESS_CARD_TEST_ID, SETTINGS_PATH } from '@cod/plugin-merchant-shell';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, setDisplayLanguage, signOut } from './dashboard-session';

/** Where the text of an empty right-to-left input starts, measured from the viewport's left edge. */
function textStart(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((input) => {
    const style = getComputedStyle(input);
    return input.getBoundingClientRect().right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
  });
}

describe('dashboard in Arabic', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'ar');
  });

  afterEach(async () => {
    await page.close();
  });

  it('translates the product list title', async () => {
    await page.goto(`${DASHBOARD_URL}/stores/active/products`);
    await page.getByTestId(PRODUCT_LIST_TEST_ID).waitFor({ state: 'attached' });
    await assertNoPageError(page);

    await expect(page.getByRole('heading', { level: 1 }).textContent()).resolves.toBe('المنتجات');
  });

  it('translates the general settings page title', async () => {
    await page.goto(`${DASHBOARD_URL}${SETTINGS_PATH}`);
    await page.getByTestId(BUSINESS_CARD_TEST_ID).waitFor({ state: 'attached' });
    await assertNoPageError(page);

    await expect(page.getByRole('heading', { level: 1 }).textContent()).resolves.toBe('عامة');
  });

  it.each([
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ])('starts the password placeholder level with the email placeholder at $width px', async (viewport) => {
    await signOut(page);
    await page.setViewportSize(viewport);
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.locator('#field-password').waitFor();

    const offset = (await textStart(page, '#field-username')) - (await textStart(page, '#field-password'));

    expect(Math.abs(offset)).toBeLessThanOrEqual(0.5);
  });
});
