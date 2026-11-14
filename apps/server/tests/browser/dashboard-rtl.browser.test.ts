import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ARABIC_FONT_FAMILY, type DocumentLang } from '@cod/plugin-merchant-shell';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DASHBOARD_PAGES_UNDER_TEST,
  DASHBOARD_URL,
  type DashboardPageUnderTest,
  SCREENSHOT_DIR,
} from './dashboard-pages';
import { assertNoPageError, DASHBOARD_LABELS, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';

/** What the document says about its language, direction and Arabic font once a page has rendered. */
interface DocumentState {
  readonly dir: string;
  readonly lang: string;
  readonly bodyFontFamily: string;
  readonly arabicFacesMatched: number;
  readonly arabicFacesLoaded: number;
}

/** Reads the document state in the page; the font load is awaited (M9), not just checked. */
async function readDocumentState(page: Page): Promise<DocumentState> {
  return page.evaluate(async (family: string): Promise<DocumentState> => {
    const matched = await document.fonts.load(`16px "${family}"`, 'ع');
    const faces = [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === family);
    return {
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      bodyFontFamily: getComputedStyle(document.body).fontFamily,
      arabicFacesMatched: matched.length,
      arabicFacesLoaded: faces.filter((face) => face.status === 'loaded').length,
    };
  }, ARABIC_FONT_FAMILY);
}

async function openPage(page: Page, target: DashboardPageUnderTest): Promise<void> {
  await page.goto(`${DASHBOARD_URL}${target.path}`);
  // The ready marker may be an empty element, so it is waited for in the DOM rather than on screen.
  await page.getByTestId(target.readyTestId).waitFor({ state: 'attached' });
  await assertNoPageError(page);
}

async function openInLanguage(page: Page, target: DashboardPageUnderTest, language: DocumentLang): Promise<void> {
  await loginAsDemoOwner(page, DASHBOARD_URL);
  await setDisplayLanguage(page, language);
  await openPage(page, target);
}

const screenshotPath = (target: DashboardPageUnderTest, language: DocumentLang): string =>
  join(SCREENSHOT_DIR, `dashboard-${target.slug}-${language}.png`);

describe('merchant dashboard host (ADR 0010)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
  });

  afterEach(async () => {
    await page.close();
  });

  it('shows the login page', async () => {
    await page.goto(`${DASHBOARD_URL}/login`);
    // waitFor() is the visibility check: it rejects when the button never becomes visible.
    const signIn = page.getByRole('button', { name: DASHBOARD_LABELS.signIn });
    await signIn.waitFor({ state: 'visible' });

    expect(new URL(page.url()).pathname).toBe(new URL(`${DASHBOARD_URL}/login`).pathname);
    await expect(signIn.isEnabled()).resolves.toBe(true);
    await expect(page.getByRole('textbox', { name: DASHBOARD_LABELS.email }).isEditable()).resolves.toBe(true);
  });

  it.each(DASHBOARD_PAGES_UNDER_TEST)('renders $path in Arabic right-to-left', async (target) => {
    await openInLanguage(page, target, 'ar');

    const state = await readDocumentState(page);
    expect(state.dir).toBe('rtl');
    expect(state.lang).toBe('ar');
    expect(state.arabicFacesMatched).toBeGreaterThan(0);
    expect(state.arabicFacesLoaded).toBeGreaterThan(0);
    expect(state.bodyFontFamily).toContain(ARABIC_FONT_FAMILY);
    await page.screenshot({ path: screenshotPath(target, 'ar'), fullPage: true });
  });

  it.each(DASHBOARD_PAGES_UNDER_TEST)('switches $path back to English left-to-right', async (target) => {
    await openInLanguage(page, target, 'en');

    const state = await readDocumentState(page);
    expect(state.dir).toBe('ltr');
    expect(state.lang).toBe('en');
    await page.screenshot({ path: screenshotPath(target, 'en'), fullPage: true });
  });
});
