import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type Browser, chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/** The storefront port; Chromium resolves every `*.localhost` name to the loopback address. */
const STOREFRONT_PORT = process.env['STOREFRONT_PORT'] ?? '3001';

/** Where the screenshots go (`SCREENSHOT_DIR`): this package's git-ignored `test-results`. */
const SCREENSHOT_DIR = process.env['SCREENSHOT_DIR'] ?? join(__dirname, '../../test-results');

const storeUrl = (host: string): string => `http://${host}:${STOREFRONT_PORT}/`;

describe('storefront hello page in a browser', () => {
  let browser: Browser;

  beforeAll(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  /** Opens a store's root in a new page, reads its heading and saves a screenshot. */
  async function storeNameShownOn(host: string, screenshot: string): Promise<string | null> {
    const page = await browser.newPage();
    try {
      await page.goto(storeUrl(host));
      const heading = page.getByTestId('store-name');
      await heading.waitFor({ state: 'visible' });
      // The DOM is complete before the first paint: wait two frames so the screenshot is not blank.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }),
      );
      const name = await heading.textContent();
      await page.screenshot({ path: join(SCREENSHOT_DIR, screenshot) });
      return name;
    } finally {
      await page.close();
    }
  }

  it('shows the demo store on demo.localhost', async () => {
    await expect(storeNameShownOn('demo.localhost', 'storefront-demo.png')).resolves.toBe('Demo Store');
  });

  it('shows the second store on second.localhost', async () => {
    await expect(storeNameShownOn('second.localhost', 'storefront-second.png')).resolves.toBe('Second Store');
  });
});
