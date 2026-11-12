import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { DEMO_OWNER_EMAIL, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import {
  addActiveMember,
  expireInvitationsOf,
  inviteThroughApi,
  memberRow,
  TEAM_URL,
  uniqueEmail,
} from './team-fixtures';

/** A phone, below the md breakpoint (768 px) where the row's Pay salary button moves into its menu. */
const PHONE_VIEWPORT = { width: 390, height: 844 };
const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
/** The row's labels in English (`plugins/team/dashboard/i18n/en.po`). */
const ROW_MENU_LABEL = 'Member actions';
const PAY_SALARY_LABEL = 'Pay salary';
const VIEW_DETAILS_LABEL = 'View details';
/** What the server refuses on one's own row (D60.5, D212), so the menu must not offer it. */
const SELF_REFUSED_LABELS = [PAY_SALARY_LABEL, 'Edit', 'Deactivate', 'Remove'];

/** How far the widest table on the page reaches past the frame that holds it, in pixels. */
const tableOverflow = (page: Page): Promise<number> =>
  page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll('table')].map(
        (table) => table.scrollWidth - (table.parentElement?.clientWidth ?? table.scrollWidth),
      ),
    ),
  );

/** Whether the menu item the keyboard highlights has focus and can be seen; false when none is highlighted. */
const highlightedItemIsVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const item = document.querySelector('[role="menuitem"][data-highlighted]');
    return item instanceof HTMLElement && item.checkVisibility() && document.activeElement === item;
  });

describe('team member row actions', () => {
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

  it('offers Pay salary in the row menu on a phone and keeps the table inside its frame', async () => {
    const email = uniqueEmail('phone');
    // An expired invitation carries the longest status badge, "Invitation expired".
    const expired = uniqueEmail('phone-expired');
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
    await inviteThroughApi(page, expired);
    await expireInvitationsOf(expired);
    await addActiveMember(browser, page, email);
    await page.setViewportSize(PHONE_VIEWPORT);
    await page.goto(TEAM_URL);
    const row = memberRow(page, email);
    await row.getByText('Active', { exact: true }).waitFor();

    await row.getByRole('button', { name: ROW_MENU_LABEL }).click();

    await page.getByRole('menuitem', { name: PAY_SALARY_LABEL, exact: true }).waitFor();
    await expect(row.getByRole('button', { name: PAY_SALARY_LABEL, exact: true }).count()).resolves.toBe(0);
    await expect(tableOverflow(page)).resolves.toBe(0);
  });

  it('offers the owner on its own row none of the actions the server refuses on oneself', async () => {
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(TEAM_URL);
    const row = memberRow(page, DEMO_OWNER_EMAIL);
    await row.getByText('Active', { exact: true }).waitFor();

    await row.getByRole('button', { name: ROW_MENU_LABEL }).click();

    await page.getByRole('menuitem', { name: VIEW_DETAILS_LABEL, exact: true }).waitFor();
    await expect(row.getByRole('button', { name: PAY_SALARY_LABEL, exact: true }).count()).resolves.toBe(0);
    const offered = (await page.getByRole('menuitem').allInnerTexts()).map((label) => label.trim());
    for (const refused of SELF_REFUSED_LABELS) expect(offered).not.toContain(refused);
  });

  it('keeps the keyboard highlight on visible items of the row menu on a desktop', async () => {
    const email = uniqueEmail('keyboard');
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
    await addActiveMember(browser, page, email);
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(TEAM_URL);
    const row = memberRow(page, email);
    await row.getByRole('button', { name: PAY_SALARY_LABEL, exact: true }).waitFor();

    await row.getByRole('button', { name: ROW_MENU_LABEL }).focus();
    await page.keyboard.press('Enter');

    await page.getByRole('menu').waitFor();
    await expect.poll(() => highlightedItemIsVisible(page)).toBe(true);
    // One lap round the menu each way, wrapping past both ends: every stop must be an item the user can see.
    const lap = (await page.getByRole('menuitem').count()) + 1;
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
      for (let step = 0; step < lap; step += 1) {
        await page.keyboard.press(key);
        await expect.poll(() => highlightedItemIsVisible(page)).toBe(true);
      }
    }
  });
});
