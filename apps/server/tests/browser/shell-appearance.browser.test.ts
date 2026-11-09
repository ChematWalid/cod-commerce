import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ARABIC_FONT_FAMILY, SHELL_SKELETON_TEST_ID, STORE_SWITCHER_TEST_ID } from '@cod/plugin-merchant-shell';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DASHBOARD_URL, SCREENSHOT_DIR } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import {
  chooseTheme,
  computedStyle,
  contrastRatio,
  isDark,
  markerOffsets,
  MIN_TEXT_CONTRAST,
  type ThemeChoice,
} from './shell-appearance-fixtures';

const DESKTOP = { width: 1280, height: 800 } as const;
const THEMES = ['light', 'dark'] as const;
const SWITCHER = `[data-testid="${STORE_SWITCHER_TEST_ID}"]`;
const SIDEBAR_LINK = '[data-sidebar="content"] [data-sidebar="menu-button"]';
const OPEN_CHEVRON = `${SIDEBAR_LINK}[aria-expanded="true"] > svg.lucide-chevron-right`;
const CLOSED_CHEVRON = `${SIDEBAR_LINK}[aria-expanded="false"] > svg.lucide-chevron-right`;
const BREADCRUMB_SEPARATOR = '[data-slot="breadcrumb-separator"] svg';
const BREADCRUMB_ITEM = '[data-slot="breadcrumb-item"]';
const NESTED_PAGE = '/cod-orders/spam';
const ACTIVE_LINK = `[data-sidebar="content"] a[href$="${NESTED_PAGE}"]`;
const AT_EDGE = '0px';
const MIRRORED = '-1 1';
const OPEN_ROTATION = '90deg';

/** The crumbs of the pages Task 9 changed: a link leaf shows one crumb, its own name, and no separator. */
const LINK_LEAF_CRUMBS: Readonly<Record<'en' | 'ar', readonly (readonly [string, string])[]>> = {
  en: [
    ['/home', 'Home'],
    ['/delivery', 'Delivery & shipping'],
  ],
  ar: [
    ['/home', 'الرئيسية'],
    ['/delivery', 'التوصيل والشحن'],
  ],
};

describe('merchant shell appearance', () => {
  let browser: Browser;
  const contexts: BrowserContext[] = [];

  beforeAll(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  /** A fresh browser context, like a first visit, signed in as the demo owner. */
  async function visit(scheme: 'light' | 'dark'): Promise<Page> {
    const context = await browser.newContext({ colorScheme: scheme, viewport: DESKTOP });
    contexts.push(context);
    const page = await context.newPage();
    await loginAsDemoOwner(page, DASHBOARD_URL);
    return page;
  }

  const open = async (page: Page, path: string): Promise<void> => {
    await page.goto(`${DASHBOARD_URL}${path}`);
    await page.locator('h1').first().waitFor();
    await assertNoPageError(page);
  };

  /** The owner's display language and theme live on the server and outlast a context: put both back. */
  afterEach(async () => {
    const [context] = contexts.slice(-1);
    const page = context?.pages()[0];
    try {
      if (page !== undefined) {
        await chooseTheme(page, 'system');
        await setDisplayLanguage(page, 'en');
      }
    } finally {
      await Promise.all(contexts.splice(0).map((each) => each.close()));
    }
  });

  describe.each(THEMES)('%s system preference', (scheme) => {
    it('is followed on a first visit', async () => {
      const page = await visit(scheme);

      await expect(isDark(page)).resolves.toBe(scheme === 'dark');
    });

    it('keeps text legible (4.5:1) in the sidebar, the top bar and the skeleton', async () => {
      const page = await visit(scheme);
      await open(page, '/home');
      await page.locator(`[data-testid="${SHELL_SKELETON_TEST_ID}"]`).waitFor();
      await page.locator(SWITCHER).waitFor();

      const targets = {
        'sidebar link': SIDEBAR_LINK,
        'toolbar label': `${SWITCHER} .font-medium`,
        'skeleton title': 'h1',
        'skeleton text': `[data-testid="${SHELL_SKELETON_TEST_ID}"]`,
        'switcher subdomain': `${SWITCHER} bdi`,
      };
      for (const [name, selector] of Object.entries(targets)) {
        const ratio = await contrastRatio(page, selector);
        expect(ratio, `${name} in ${scheme}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
      }
      await page.screenshot({ path: join(SCREENSHOT_DIR, `shell-appearance-${scheme}.png`) });
    });
  });

  it.each([
    ['dark', 'light'],
    ['light', 'dark'],
  ] as const satisfies readonly (readonly [ThemeChoice, 'light' | 'dark'])[])(
    'keeps a chosen %s theme across a reload and over a %s system preference',
    async (choice, scheme) => {
      const page = await visit(scheme);

      await chooseTheme(page, choice);
      await page.reload();
      await page.locator(SWITCHER).waitFor();

      await expect(isDark(page)).resolves.toBe(choice === 'dark');
      // The server stores the choice with the user's settings, so another browser gets it too.
      const other = await visit(scheme);
      await expect.poll(() => isDark(other)).toBe(choice === 'dark');
    },
  );

  describe('Arabic right-to-left', () => {
    it.each(THEMES)(
      'puts the sidebar on the right and tells an open section from a closed one (%s)',
      async (scheme) => {
        const page = await visit(scheme);
        await setDisplayLanguage(page, 'ar');
        await open(page, NESTED_PAGE);

        await expect(page.locator('[data-side]').first().getAttribute('data-side')).resolves.toBe('right');
        const openRotation = await computedStyle(page, OPEN_CHEVRON, 'rotate');
        const closed = await computedStyle(page, CLOSED_CHEVRON, 'rotate');
        expect(openRotation).toBe(OPEN_ROTATION);
        expect(closed).not.toBe(openRotation);
      },
    );

    it('draws the active-row marker on the side the text starts, in both directions', async () => {
      const page = await visit('light');
      await setDisplayLanguage(page, 'ar');
      await open(page, NESTED_PAGE);
      await expect(markerOffsets(page, ACTIVE_LINK)).resolves.toMatchObject({ right: AT_EDGE });
      expect((await markerOffsets(page, ACTIVE_LINK)).left).not.toBe(AT_EDGE);

      await setDisplayLanguage(page, 'en');
      await expect(markerOffsets(page, ACTIVE_LINK)).resolves.toMatchObject({ left: AT_EDGE });
    });

    it.each(THEMES)(
      'mirrors the breadcrumb separator and the sidebar toggle, and leaves English alone (%s)',
      async (scheme) => {
        const page = await visit(scheme);
        await setDisplayLanguage(page, 'ar');
        await open(page, NESTED_PAGE);

        await expect(computedStyle(page, BREADCRUMB_SEPARATOR, 'scale')).resolves.toBe(MIRRORED);
        await expect(computedStyle(page, 'svg.lucide-panel-left', 'scale')).resolves.toBe(MIRRORED);

        await setDisplayLanguage(page, 'en');
        await expect(computedStyle(page, BREADCRUMB_SEPARATOR, 'scale')).resolves.toBe('none');
        await expect(computedStyle(page, 'svg.lucide-panel-left', 'scale')).resolves.toBe('none');
        await expect(page.locator('[data-side]').first().getAttribute('data-side')).resolves.toBe('left');
      },
    );

    it('loads the body font from our own origin and no font from a third party', async () => {
      const page = await visit('light');
      const fontUrls: string[] = [];
      page.on('request', (request) => {
        if (request.resourceType() === 'font') fontUrls.push(request.url());
      });
      await setDisplayLanguage(page, 'ar');
      await open(page, NESTED_PAGE);
      await page.evaluate(async (family: string) => {
        await document.fonts.load(`16px "${family}"`, 'ع');
        await document.fonts.ready;
      }, ARABIC_FONT_FAMILY);

      await expect(page.evaluate(() => getComputedStyle(document.body).fontFamily)).resolves.toContain(
        ARABIC_FONT_FAMILY,
      );
      expect(fontUrls.length).toBeGreaterThan(0);
      const origin = new URL(DASHBOARD_URL).origin;
      expect(fontUrls.filter((url) => new URL(url).origin !== origin)).toEqual([]);
    });
  });

  describe.each(['en', 'ar'] as const)('breadcrumbs in %s', (language) => {
    it.each(LINK_LEAF_CRUMBS[language])('%s shows its own name once, without a separator', async (path, title) => {
      const page = await visit('light');
      await setDisplayLanguage(page, language);
      await open(page, path);

      await expect(page.locator(BREADCRUMB_ITEM).allInnerTexts()).resolves.toEqual([title]);
      await expect(page.locator(BREADCRUMB_SEPARATOR).count()).resolves.toBe(0);
      await page.screenshot({
        path: join(SCREENSHOT_DIR, `shell-crumb${path.replace('/', '-')}-${language}.png`),
        clip: { x: 0, y: 0, width: DESKTOP.width, height: 120 },
      });
    });
  });
});
