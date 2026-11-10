import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from '@cod/shared';
import { LOGIN_BRAND_TEST_ID } from '@cod/plugin-merchant-shell';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsSuperadmin } from './dashboard-session';

/** The framework's name in the stock tab title and meta tags; the licence footer is its one allowed mention. */
const VENDOR_NAME = /vendure/i;
const HOME_PATH = '/home';
const ICON_FILE_NAME = 'brand-icon.svg';

/**
 * The footer `[data-vendure-branding]` is the one element excluded: `@vendure/dashboard` marks it as a
 * licensing requirement, and removing it is the user's decision (P0.S2c-polish handoff).
 */
const LICENCE_FOOTER = '[data-vendure-branding]';

/** The login page's visible text and SVG count, without the licence footer. */
function readBrandableLogin(page: Page): Promise<{ text: string; stockLogos: number }> {
  return page.evaluate((footer: string) => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(footer).forEach((element) => {
      element.remove();
    });
    return { text: clone.textContent, stockLogos: clone.querySelectorAll('svg.text-brand').length };
  }, LICENCE_FOOTER);
}

describe('dashboard login branding (ADR 0007)', () => {
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
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.getByTestId(LOGIN_BRAND_TEST_ID).waitFor();
  });

  afterEach(async () => {
    await page.close();
  });

  it('shows the product name in place of the stock logo', async () => {
    await expect(page.getByTestId(LOGIN_BRAND_TEST_ID).textContent()).resolves.toContain(PRODUCT_NAME);
    expect((await readBrandableLogin(page)).stockLogos).toBe(0);
  });

  it('names no framework outside the licence footer', async () => {
    expect((await readBrandableLogin(page)).text).not.toMatch(/vendure/i);
  });

  it('keeps the licence footer', async () => {
    await expect(page.locator(LICENCE_FOOTER).count()).resolves.toBeGreaterThan(0);
  });

  it('names the product, not the framework, in the tab title on the login page', async () => {
    await page.waitForFunction((vendor: string) => !new RegExp(vendor, 'i').test(document.title), VENDOR_NAME.source);
    const title = await page.title();
    expect(title).toContain(PRODUCT_NAME);
    expect(title).not.toMatch(VENDOR_NAME);
  });

  it('serves our icon and meta tags, none naming the framework', async () => {
    const tags = await page.evaluate(() => ({
      icon: document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? '',
      description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '',
      author: document.querySelector<HTMLMetaElement>('meta[name="author"]')?.content ?? '',
    }));
    expect(tags.icon).toBe(`${DASHBOARD_URL}/${ICON_FILE_NAME}`);
    expect(`${tags.description} ${tags.author}`).not.toMatch(VENDOR_NAME);
    expect(`${tags.description} ${tags.author}`).toContain(PRODUCT_NAME);
    const response = await page.request.get(tags.icon);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/svg+xml');
  });

  it('names the product, not the framework, in the tab title once signed in', async () => {
    await loginAsSuperadmin(page, DASHBOARD_URL);
    await page.goto(`${DASHBOARD_URL}${HOME_PATH}`);
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    expect(title).toContain(PRODUCT_NAME);
    expect(title).not.toMatch(VENDOR_NAME);
  });
});
