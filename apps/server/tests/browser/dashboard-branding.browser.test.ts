import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { PRODUCT_NAME } from '@cod/shared';
import { LOGIN_BRAND_TEST_ID } from '@cod/plugin-merchant-shell';
import { DASHBOARD_URL } from './dashboard-pages';

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
});
