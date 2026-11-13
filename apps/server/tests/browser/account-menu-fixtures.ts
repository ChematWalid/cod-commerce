import { ACCOUNT_MENU_TEST_ID } from '@cod/plugin-merchant-shell';
import type { Page } from 'playwright-core';
import { expect } from 'vitest';
import { adminApi } from './store-switcher-fixtures';

/** The settings-store key under which the dashboard keeps a user's settings (`@vendure/dashboard` storage-keys.ts). */
const USER_SETTINGS_KEY = 'vendure.dashboard.userSettings';

/** A layout direction the document can take. */
export type DocumentDir = 'ltr' | 'rtl';

/** The signed-in user's settings as the dashboard stored them (display language, theme and the rest). */
export async function userSettings(page: Page): Promise<Record<string, unknown>> {
  const { getSettingsStoreValue: current } = await adminApi<{ getSettingsStoreValue: Record<string, unknown> | null }>(
    page,
    'query ($key: String!) { getSettingsStoreValue(key: $key) }',
    { key: USER_SETTINGS_KEY },
  );
  return current ?? {};
}

/**
 * Stores some of the signed-in user's settings through the Admin API, as the dashboard itself does, without opening a
 * menu. Cleanup uses it, so that a test that failed with a menu open cannot also fail to put English back.
 */
export async function storeUserSettings(page: Page, changes: Readonly<Record<string, unknown>>): Promise<void> {
  const value = { ...(await userSettings(page)), ...changes };
  const { setSettingsStoreValue: saved } = await adminApi<{
    setSettingsStoreValue: { result: boolean; error: string | null };
  }>(page, 'mutation ($input: SettingsStoreInput!) { setSettingsStoreValue(input: $input) { result error } }', {
    input: { key: USER_SETTINGS_KEY, value },
  });
  if (!saved.result) throw new Error(`storing the user settings failed: ${saved.error ?? 'no reason given'}`);
}

/**
 * Puts the pointer on the element and nudges it one pixel twice, so Chromium sends fresh `mousemove`s there: the events a
 * hover-opened submenu needs to reopen.
 */
export async function nudgePointerOnto(page: Page, selector: string): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (box === null) throw new Error(`${selector} has no box to put the pointer on`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 1, y);
  await page.mouse.move(x, y);
}

/** The account menu is closed: its trigger says so, no menu is left in the DOM, and the document has `dir`. */
export async function expectAccountMenuClosed(page: Page, dir: DocumentDir): Promise<void> {
  const trigger = page.locator(`[data-testid="${ACCOUNT_MENU_TEST_ID}"]`);
  await expect(trigger.getAttribute('aria-expanded')).resolves.not.toBe('true');
  await expect(page.locator('[role="menu"]').count()).resolves.toBe(0);
  await expect(page.evaluate(() => document.documentElement.dir)).resolves.toBe(dir);
}
