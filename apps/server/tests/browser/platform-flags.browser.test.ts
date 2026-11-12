import { FLAG_KEYS } from '@cod/shared';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, loginAsSuperadmin, setDisplayLanguage } from './dashboard-session';
import {
  adminApi,
  defaultSwitch,
  demoBusinessId,
  FLAGS_URL,
  flagRow,
  isFlagMutation,
  openFlags,
  overridesToggle,
  rejectsOnFlagUpdate,
  resetRollout,
  rolloutInput,
  trackFlagUpdates,
} from './platform-flags-fixtures';

const FLAGS_LINK = 'a[href$="/platform/flags"]';
const SIDEBAR = '[data-sidebar="sidebar"]';
const NOT_FOUND = '[data-testid="merchant-not-found"]';
const LICENCE_NOTICE = '[data-vendure-branding]';
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const ARABIC_TITLE = 'مفاتيح الميزات';
const ARABIC_LETTER = /[؀-ۿ]/;
const AI = FLAG_KEYS.ai;
const SEED_KEYS = Object.values(FLAG_KEYS);

describe('platform flags screen', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  describe('as the superadmin', () => {
    beforeEach(async () => {
      await loginAsSuperadmin(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
    });

    it('shows the platform section in the sidebar and opens the flags from it', async () => {
      await page.goto(`${DASHBOARD_URL}/`, { waitUntil: 'domcontentloaded' });

      const section = page.locator(`${SIDEBAR} [data-sidebar="menu-button"]`).filter({ hasText: /^Platform$/ });
      await section.first().waitFor();
      await section.first().click();
      const link = page.locator(`${SIDEBAR} ${FLAGS_LINK}`);
      await link.first().waitFor();
      await expect(link.first().innerText()).resolves.toContain('Feature flags');
      await link.first().click();
      await flagRow(page, AI).waitFor();
      await expect(page.getByRole('heading', { name: 'Feature flags' }).first().isVisible()).resolves.toBe(true);
    });

    it('lists the four seeded flags with their key, default, rollout and overrides', async () => {
      await openFlags(page);

      for (const key of SEED_KEYS) {
        await expect(flagRow(page, key).count()).resolves.toBe(1);
        await expect(flagRow(page, key).locator('bdi').first().innerText()).resolves.toBe(key);
        await expect(defaultSwitch(page, key).getAttribute('aria-checked')).resolves.toBe('true');
        await expect(rolloutInput(page, key).inputValue()).resolves.toBe('100');
      }
      await expect(page.locator('[data-testid^="flag-row-"]').count()).resolves.toBe(SEED_KEYS.length);
    });

    it('shows no other product name on the screen', async () => {
      await openFlags(page);

      const text = await page.evaluate((notice: string) => {
        const hidden = [...document.querySelectorAll<HTMLElement>(notice)];
        const display = hidden.map((element) => element.style.display);
        hidden.forEach((element) => {
          element.style.display = 'none';
        });
        const rendered = document.body.innerText;
        hidden.forEach((element, index) => {
          element.style.display = display[index] ?? '';
        });
        return rendered;
      }, LICENCE_NOTICE);
      expect(text).not.toMatch(/vendure/i);
    });

    it('switches ai.enabled off, keeps it off across a reload, and switches it back on', async () => {
      await openFlags(page);
      try {
        const saved = page.waitForResponse(isFlagMutation('updateFeatureFlag'));
        await defaultSwitch(page, AI).click();
        await saved;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await flagRow(page, AI).waitFor();

        await expect(defaultSwitch(page, AI).getAttribute('aria-checked')).resolves.toBe('false');
        const other = SEED_KEYS.filter((key) => key !== AI);
        for (const key of other) {
          await expect(defaultSwitch(page, key).getAttribute('aria-checked')).resolves.toBe('true');
        }
      } finally {
        await adminApi(page, `mutation { updateFeatureFlag(input: { key: "${AI}", defaultEnabled: true }) { key } }`);
      }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await flagRow(page, AI).waitFor();
      await expect(defaultSwitch(page, AI).getAttribute('aria-checked')).resolves.toBe('true');
    });

    it('saves a rollout of 30 on Enter and keeps it across a reload', async () => {
      await openFlags(page);
      try {
        const saved = page.waitForResponse(isFlagMutation('updateFeatureFlag'));
        await rolloutInput(page, FLAG_KEYS.capi).fill('30');
        await rolloutInput(page, FLAG_KEYS.capi).press('Enter');
        await saved;
        await page.reload({ waitUntil: 'domcontentloaded' });
        await flagRow(page, FLAG_KEYS.capi).waitFor();

        await expect(rolloutInput(page, FLAG_KEYS.capi).inputValue()).resolves.toBe('30');
      } finally {
        await resetRollout(page, FLAG_KEYS.capi);
      }
    });

    it('saves a rollout on blur, once, and keeps it across a reload', async () => {
      await openFlags(page);
      const sent = trackFlagUpdates(page);
      try {
        const saved = page.waitForResponse(isFlagMutation('updateFeatureFlag'));
        const field = rolloutInput(page, FLAG_KEYS.intakeSpool);
        await field.fill('40');
        await field.blur();
        await saved;
        const noSecondSave = rejectsOnFlagUpdate(page);
        await field.press('Enter');
        await field.blur();
        await noSecondSave;
        expect(sent).toHaveLength(1);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await expect(rolloutInput(page, FLAG_KEYS.intakeSpool).inputValue()).resolves.toBe('40');
      } finally {
        await resetRollout(page, FLAG_KEYS.intakeSpool);
      }
    });

    it('refuses a rollout outside 0 to 100 on blur without calling the server', async () => {
      await openFlags(page);
      const sent = trackFlagUpdates(page);
      const field = rolloutInput(page, FLAG_KEYS.intakeSpool);

      await field.fill('150');
      await field.blur();

      await expect(field.getAttribute('aria-invalid')).resolves.toBe('true');
      expect(sent).toHaveLength(0);
    });

    it('adds a business override that evaluateFeatureFlag honours, and removes it', async () => {
      const businessId = await demoBusinessId(browser);
      const evaluate = async (): Promise<boolean | undefined> =>
        (
          (await adminApi(page, `query { evaluateFeatureFlag(key: "${AI}", businessId: "${businessId}") }`)).data as
            { evaluateFeatureFlag: boolean } | undefined
        )?.evaluateFeatureFlag;
      await openFlags(page);
      try {
        await expect(evaluate()).resolves.toBe(true);
        await expect(overridesToggle(page, AI).innerText()).resolves.toMatch(/0/);

        await overridesToggle(page, AI).click();
        await page.getByRole('button', { name: 'Add override' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByRole('combobox').first().click();
        await page.getByRole('option', { name: 'Business' }).click();
        await dialog.getByLabel('Target id').fill(businessId);
        await dialog.getByRole('switch').click();
        const saved = page.waitForResponse(isFlagMutation('setFeatureFlagOverride'));
        await dialog.getByRole('button', { name: 'Save' }).click();
        await saved;

        const listed = page.locator(`[data-testid="flag-override-${AI}-business-${businessId}"]`);
        await listed.waitFor();
        await expect(listed.innerText()).resolves.toContain(businessId);
        await expect(evaluate()).resolves.toBe(false);
        await expect(overridesToggle(page, AI).innerText()).resolves.toMatch(/1/);

        const removed = page.waitForResponse(isFlagMutation('removeFeatureFlagOverride'));
        await listed.getByRole('button', { name: 'Remove' }).click();
        await removed;
        await listed.waitFor({ state: 'detached' });
        await expect(evaluate()).resolves.toBe(true);
      } finally {
        await adminApi(
          page,
          `mutation { removeFeatureFlagOverride(input: { key: "${AI}", scope: BUSINESS, scopeId: "${businessId}" }) { key } }`,
        );
      }
    });

    it('shows the error for a target that does not exist, in words, and keeps the dialog open', async () => {
      await openFlags(page);
      await overridesToggle(page, AI).click();
      await page.getByRole('button', { name: 'Add override' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Business' }).click();
      await dialog.getByLabel('Target id').fill('9999999999999999');

      await dialog.getByRole('button', { name: 'Save' }).click();

      await expect(dialog.getByRole('alert').innerText()).resolves.toBe(
        'No business or store has that id. Check it and try again.',
      );
      await expect(dialog.isVisible()).resolves.toBe(true);
    });

    it('fits a 390 px screen without a horizontal scroll', async () => {
      await page.setViewportSize(PHONE);
      await openFlags(page);

      const widths = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
    });

    it('renders right to left in Arabic with a translated heading and keys that stay left to right', async () => {
      await setDisplayLanguage(page, 'ar');
      try {
        await openFlags(page);

        await expect(page.evaluate(() => document.documentElement.dir)).resolves.toBe('rtl');
        await expect(page.getByRole('heading', { name: ARABIC_TITLE }).first().isVisible()).resolves.toBe(true);
        const key = flagRow(page, AI).locator('bdi').first();
        await expect(key.innerText()).resolves.toBe(AI);
        await expect(key.evaluate((element) => getComputedStyle(element).direction)).resolves.toBe('ltr');
        // The description is staff-edited data and stays as stored; the column headers are ours.
        const headerText = await page.locator('thead').first().innerText();
        expect(headerText).toMatch(ARABIC_LETTER);
        expect(headerText).not.toMatch(/[A-Za-z]/);
        await page.setViewportSize(PHONE);
        const widths = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
        }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.inner);
      } finally {
        // The user menu lives in the sidebar, which a phone width collapses.
        await page.setViewportSize(DESKTOP);
        await setDisplayLanguage(page, 'en');
      }
    });
  });

  describe('as the demo owner', () => {
    beforeEach(async () => {
      await loginAsDemoOwner(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
    });

    it('has no platform section in the sidebar', async () => {
      await page.goto(`${DASHBOARD_URL}/home`, { waitUntil: 'domcontentloaded' });
      await page.locator(SIDEBAR).first().waitFor({ state: 'attached' });

      await expect(page.locator(FLAGS_LINK).count()).resolves.toBe(0);
      expect(await page.locator(SIDEBAR).first().innerText()).not.toMatch(/Platform/);
    });

    it('answers /platform/flags with the not-found page and sends no flags query', async () => {
      const queries: string[] = [];
      page.on('request', (request) => {
        const body = request.postData() ?? '';
        if (/featureFlags|updateFeatureFlag|FeatureFlagOverride/.test(body)) queries.push(body);
      });

      await page.goto(FLAGS_URL, { waitUntil: 'domcontentloaded' });
      await page.locator(NOT_FOUND).waitFor();
      await page.waitForLoadState('networkidle');

      expect(queries).toEqual([]);
      await expect(page.locator('[data-testid^="flag-row-"]').count()).resolves.toBe(0);
    });
  });
});
