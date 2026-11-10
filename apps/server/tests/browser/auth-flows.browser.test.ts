import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from 'vitest';
import { REGISTER_FORM_TEST_ID, VERIFY_BANNER_TEST_ID } from '../../../../plugins/auth/dashboard/constants';
import { DASHBOARD_URL } from './dashboard-pages';
import { emailSecrets, waitForEmail } from './mailpit';

const MAILPIT_URL = (process.env['MAILPIT_URL'] ?? 'http://localhost:8025').replace(/\/$/, '');
const PASSWORD = 'synthetic-browser-password';
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
const STALE_CHANNEL_TOKEN = 'stale-channel-token-of-a-previous-account';
/** A subdomain the demo seed created, so it is always taken. */
const TAKEN_SUBDOMAIN = 'demo';
const OTP_SETTLE_MS = 15_000;
const LICENCE_FOOTER = '[data-vendure-branding]';
/** `PLATFORM_DOMAIN` of the stack under test (localhost in development, CI and the evidence project). */
const PLATFORM_SUFFIX = '.localhost';

let sequence = 0;
/** Unique per run and per call: the database keeps what earlier runs registered. */
function unique(): string {
  sequence += 1;
  return `b${Date.now().toString(36)}${String(sequence)}`;
}

const createButton = (page: Page) => page.getByRole('button', { name: 'Create', exact: true });

async function openStoreStep(page: Page, email: string): Promise<void> {
  await page.goto(`${DASHBOARD_URL}/register`);
  await page.getByTestId(REGISTER_FORM_TEST_ID).waitFor();
  await expect(page.getByText('Step 1 of 3').count()).resolves.toBe(1);
  await page.getByRole('textbox', { name: 'Email' }).fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(PASSWORD);
  await page.getByRole('textbox', { name: 'First name' }).fill('Browser');
  await page.getByRole('textbox', { name: 'Last name' }).fill('Merchant');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Step 2 of 3').waitFor();
  await page.getByRole('textbox', { name: 'Business name' }).fill('Browser Business');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('Step 3 of 3').waitFor();
  await expect(page.getByText('Step 4').count()).resolves.toBe(0);
  await page.getByRole('textbox', { name: 'Store name' }).fill('Browser Store');
}

const addressField = (page: Page) => page.getByRole('textbox', { name: 'Store address' });

/** The stores the session sees with the channel the dashboard selected: throws on FORBIDDEN. */
async function storesOfSelectedChannel(page: Page): Promise<string[]> {
  const answer = await page.evaluate(async (key) => {
    const response = await fetch('/admin-api', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
      body: JSON.stringify({ query: 'query { stores { subdomain } }' }),
    });
    return (await response.json()) as { data?: { stores: { subdomain: string }[] }; errors?: unknown };
  }, SELECTED_CHANNEL_KEY);
  if (answer.data === undefined) throw new Error(`stores failed: ${JSON.stringify(answer.errors)}`);
  return answer.data.stores.map(({ subdomain }) => subdomain);
}

describe('auth flows in a real browser', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await (await browser.newContext()).newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  it('walks three steps, offers exactly the three store languages and shows a taken address', async () => {
    await openStoreStep(page, `${unique()}@evidence.example.test`);
    await page.getByRole('combobox', { name: 'Store language' }).click();
    await expect(page.getByRole('option').allTextContents()).resolves.toEqual(['العربية', 'Français', 'English']);
    await page.keyboard.press('Escape');
    await expect(createButton(page).isDisabled()).resolves.toBe(true);
    await addressField(page).fill(TAKEN_SUBDOMAIN);
    await page.getByText('This address is already taken').waitFor();
    await expect(createButton(page).isDisabled()).resolves.toBe(true);
    await addressField(page).fill(unique());
    await expect(createButton(page).isDisabled()).resolves.toBe(true);
    await page.getByText('This address is available').waitFor();
    await expect(createButton(page).isEnabled()).resolves.toBe(true);
  });

  it('lands on the new store despite a stale channel, and the banner leaves after the emailed code', async () => {
    const email = `${unique()}@evidence.example.test`;
    const subdomain = unique();
    await page.addInitScript(
      ([key, value]) => {
        localStorage.setItem(key, value);
      },
      [SELECTED_CHANNEL_KEY, STALE_CHANNEL_TOKEN] as const,
    );
    await openStoreStep(page, email);
    await addressField(page).fill(subdomain);
    await page.getByText('This address is available').waitFor();
    await createButton(page).click();
    const banner = page.getByTestId(VERIFY_BANNER_TEST_ID);
    await banner.waitFor();
    await page.waitForURL((url) => url.pathname === `${new URL(DASHBOARD_URL).pathname}/home`); // D84: the root lands on Home
    await expect(storesOfSelectedChannel(page)).resolves.toEqual([subdomain]);

    const { code } = emailSecrets(await waitForEmail(MAILPIT_URL, email, { contains: '/verify-email' }));
    await banner.getByRole('textbox', { name: 'Verification code' }).fill(code ?? '');
    await banner.getByRole('button', { name: 'Verify', exact: true }).click();
    await banner.waitFor({ state: 'detached', timeout: OTP_SETTLE_MS });
  });

  it('keeps the address and its domain suffix left to right on an Arabic page', async () => {
    await openStoreStep(page, `${unique()}@evidence.example.test`);
    await page.locator('button[lang="ar"]').click();
    await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    const row = await page.evaluate((suffix) => {
      const label = [...document.querySelectorAll('span')].find((element) => element.textContent === suffix);
      if (label === undefined || label.parentElement === null) throw new Error('no address suffix on the page');
      const input = label.parentElement.querySelector('input');
      if (input === null) throw new Error('no input in the suffix row');
      return { inputRight: input.getBoundingClientRect().right, suffixLeft: label.getBoundingClientRect().left };
    }, PLATFORM_SUFFIX);
    expect(row.suffixLeft).toBeGreaterThanOrEqual(row.inputRight);
  });

  it('shows no provider button with the flag off, and keeps the login footer', async () => {
    await page.goto(`${DASHBOARD_URL}/login`);
    await page.getByRole('link', { name: 'Create account' }).waitFor();
    await expect(page.getByText(/Continue with/).count()).resolves.toBe(0);
    await expect(page.locator(LICENCE_FOOTER).count()).resolves.toBe(1);
  });
});
