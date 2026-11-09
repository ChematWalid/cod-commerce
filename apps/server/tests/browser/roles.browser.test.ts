import { BUILT_IN_ROLES, PERMISSION_AREAS, PERMISSION_CATALOG } from '@cod/shared';
import { type Browser, chromium, type Locator, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';

const ROLES_URL = `${DASHBOARD_URL}/team/roles`;
const ROLES_LINK = 'a[href$="/team/roles"]';
const LICENCE_FOOTER = '[data-vendure-branding]';
const SELECTED_CHANNEL_KEY = 'vendure-selected-channel-token';
const ORDERS_MEMBER_EMAIL = 'orders@demo.example.test';
const LIMITED_MEMBER_EMAIL = 'limited@demo.example.test';
const TOTAL = PERMISSION_CATALOG.length;

const ordersArea = PERMISSION_AREAS.find((area) => area.id === 'orders');
const orderTracker = BUILT_IN_ROLES.find((role) => role.key === 'order-tracker');
if (ordersArea === undefined || orderTracker === undefined) throw new Error('the catalog lost an expected entry');
const ORDERS_LABEL = ordersArea.label.en;
const ORDERS_ENTRIES = PERMISSION_CATALOG.filter((entry) => entry.area === 'orders');
const ORDERS_VIEW_COUNT = ORDERS_ENTRIES.filter((entry) => entry.level === 'view').length;
const ORDERS_SENSITIVE_COUNT = ORDERS_ENTRIES.filter((entry) => entry.sensitive).length;

/** The refusal code of a `businessRoles` call on the active store, or `null` when it was answered. */
function businessRolesRefusal(page: Page): Promise<string | null> {
  return page.evaluate(async (key: string) => {
    const response = await fetch('/admin-api', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'vendure-token': localStorage.getItem(key) ?? '' },
      body: JSON.stringify({ query: 'query { businessRoles { id } }' }),
    });
    const body = (await response.json()) as { errors?: { extensions?: { code?: string } }[] };
    return body.errors?.[0]?.extensions?.code ?? null;
  }, SELECTED_CHANNEL_KEY);
}

const newRoleDialog = async (page: Page): Promise<Locator> => {
  await page.goto(ROLES_URL);
  await page.getByRole('button', { name: 'New role', exact: true }).click();
  return page.getByRole('dialog');
};

const openOrders = async (dialog: Locator): Promise<Locator> => {
  await dialog.getByRole('button', { name: new RegExp(`^${ORDERS_LABEL}`) }).click();
  return dialog.getByRole('radiogroup', { name: ORDERS_LABEL }).locator('xpath=..');
};

const rowOf = (page: Page, name: string): Locator => page.getByRole('row').filter({ hasText: name });

const deleteRole = async (page: Page, name: string): Promise<void> => {
  await rowOf(page, name).getByRole('button', { name: 'Role actions' }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await rowOf(page, name).waitFor({ state: 'detached' });
};

describe('roles page', () => {
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

  describe('as the owner', () => {
    beforeEach(async () => {
      await loginAsDemoOwner(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
    });

    it('lists the 12 areas in the new-role dialog', async () => {
      const dialog = await newRoleDialog(page);

      await expect(dialog.locator('[data-slot="accordion-item"]').count()).resolves.toBe(PERMISSION_AREAS.length);
      expect(PERMISSION_AREAS).toHaveLength(12);
    });

    it('marks the three view rows when Orders is set to View', async () => {
      const dialog = await newRoleDialog(page);
      const panel = await openOrders(dialog);

      await panel.getByRole('radio', { name: 'View', exact: true }).click();

      await expect(panel.locator('[role="switch"][aria-checked="true"]').count()).resolves.toBe(ORDERS_VIEW_COUNT);
      expect(ORDERS_VIEW_COUNT).toBe(3);
    });

    it('shows a Sensitive badge on each sensitive permission', async () => {
      const dialog = await newRoleDialog(page);
      const panel = await openOrders(dialog);

      await expect(panel.getByText('Sensitive', { exact: true }).count()).resolves.toBe(ORDERS_SENSITIVE_COUNT);
    });

    it('copies a template with Start from', async () => {
      const dialog = await newRoleDialog(page);

      await dialog.getByRole('combobox').click();
      await page.getByRole('option', { name: orderTracker.label.en, exact: true }).click();

      await dialog.getByText(`${String(orderTracker.permissions.length)} / ${String(TOTAL)}`).waitFor();
    });

    it('adds (copy) when a role is duplicated', async () => {
      const name = `Browser role ${String(Date.now())}`;
      const dialog = await newRoleDialog(page);
      await dialog.getByRole('textbox', { name: 'Name' }).fill(name);
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await rowOf(page, name).waitFor();

      await rowOf(page, name).getByRole('button', { name: 'Role actions' }).click();
      await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();

      await rowOf(page, `${name} (copy)`).waitFor();

      // The copy first: a row's filter matches on a substring, so the original's would match both while the copy exists.
      await deleteRole(page, `${name} (copy)`);
      await deleteRole(page, name);
    });
  });

  it('shows a read-only member the table without any write control', async () => {
    await loginAsOwner(page, DASHBOARD_URL, LIMITED_MEMBER_EMAIL);
    await setDisplayLanguage(page, 'en');
    await page.goto(ROLES_URL);

    await rowOf(page, 'Demo viewer').waitFor();

    await expect(page.getByRole('button', { name: 'New role', exact: true }).count()).resolves.toBe(0);
    await expect(page.getByRole('button', { name: 'Role actions' }).count()).resolves.toBe(0);
  });

  it('gives a member without team.roles.view no nav entry and refuses the query', async () => {
    await loginAsOwner(page, DASHBOARD_URL, ORDERS_MEMBER_EMAIL);

    await expect(page.locator(ROLES_LINK).count()).resolves.toBe(0);
    await expect(businessRolesRefusal(page)).resolves.toBe('FORBIDDEN');
  });

  it('keeps the licence footer on the login page', async () => {
    await page.goto(`${DASHBOARD_URL}/login`);

    await page.locator(LICENCE_FOOTER).waitFor();
  });
});
