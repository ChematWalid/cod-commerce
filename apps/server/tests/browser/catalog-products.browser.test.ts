import {
  CREATE_PRODUCT_TEST_ID,
  PRODUCT_LIST_TEST_ID,
  PRODUCT_ROW_TEST_ID,
  PRODUCT_SEARCH_TEST_ID,
  PRODUCT_TABS_TEST_ID,
} from '@cod/plugin-catalog';
import { SHELL_SKELETON_TEST_ID } from '@cod/plugin-merchant-shell';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import { adminApi, byTestId, switchableStores } from './store-switcher-fixtures';

const PER_STORE_MEMBER_EMAIL = 'perstore@demo.example.test';
const VIEW_PRODUCTS_KEY = 'catalog.products.view';
const CREATE_PRODUCTS_KEY = 'catalog.products.create';

interface PermissionsAnswer {
  readonly data: { readonly effectivePermissions: { readonly permissions: readonly string[] } };
}
const PRODUCTS_PATH = '/stores/active/products';
const runId = Date.now().toString(36);

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const rows = (page: Page) => byTestId(page, PRODUCT_ROW_TEST_ID);

/** A product of the active store, created through the catalog API with the session of `page`. */
async function createProduct(page: Page, title: string, status: 'active' | 'draft'): Promise<string> {
  const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
    page,
    'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    { input: { title, status, price: 2500 } },
  );
  return createCatalogProduct.product.id;
}

const deleteProduct = (page: Page, id: string) =>
  adminApi(page, 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id });

describe('catalog product list', () => {
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
    const created: string[] = [];

    beforeEach(async () => {
      await loginAsDemoOwner(page, DASHBOARD_URL);
      await setDisplayLanguage(page, 'en');
    });

    afterEach(async () => {
      for (const id of created.splice(0)) await deleteProduct(page, id);
    });

    it('shows the product list instead of the skeleton', async () => {
      await open(page, PRODUCTS_PATH);

      await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
      await assertNoPageError(page);
      await expect(byTestId(page, SHELL_SKELETON_TEST_ID).count()).resolves.toBe(0);
      await expect(page.getByRole('heading', { level: 1 }).textContent()).resolves.toBe('Products');
      await byTestId(page, CREATE_PRODUCT_TEST_ID).waitFor();
    });

    it('lists only drafts on the Draft tab and narrows the list by search', async () => {
      const draftTitle = `Draft shoe ${runId}`;
      const activeTitle = `Active shoe ${runId}`;
      created.push(
        await createProduct(page, draftTitle, 'draft'),
        await createProduct(page, activeTitle, 'active'),
        // Outside the search, so the search has something to leave out.
        await createProduct(page, 'Unrelated scarf', 'active'),
      );
      await open(page, PRODUCTS_PATH);
      await expect.poll(() => rows(page).count()).toBeGreaterThan(2);
      await byTestId(page, PRODUCT_SEARCH_TEST_ID).fill(runId);
      await expect.poll(() => rows(page).count()).toBe(2);
      await expect(rows(page).allInnerTexts()).resolves.toEqual(
        expect.arrayContaining([expect.stringContaining(activeTitle), expect.stringContaining(draftTitle)]),
      );

      await byTestId(page, PRODUCT_TABS_TEST_ID).getByRole('tab', { name: 'Draft' }).click();

      await expect.poll(() => rows(page).allInnerTexts()).toEqual([expect.stringContaining(draftTitle)]);
    });

    it('renders the list right-to-left in Arabic', async () => {
      await setDisplayLanguage(page, 'ar');
      await open(page, PRODUCTS_PATH);

      await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
      await expect(page.getByRole('heading', { level: 1 }).textContent()).resolves.toBe('المنتجات');
      await expect(page.evaluate(() => document.documentElement.dir)).resolves.toBe('rtl');
    });
  });

  it('shows a member with the view key alone the list without Create product', async () => {
    await loginAsOwner(page, DASHBOARD_URL, PER_STORE_MEMBER_EMAIL);
    // The member holds the view key on the business's first store only (seed-demo-members.ts).
    const [first] = await switchableStores(page);
    if (first === undefined) throw new Error('the member reaches a store');
    const permissionsAnswer = page.waitForResponse(
      (response) => response.request().postData()?.includes('CatalogEffectivePermissions') ?? false,
    );
    await open(page, `/stores/${first.id}/products`);

    // The page shows Create only once this answer holds the key, so wait for it: an absent answer would also hide it.
    const { data } = (await (await permissionsAnswer).json()) as PermissionsAnswer;
    expect(data.effectivePermissions.permissions).toContain(VIEW_PRODUCTS_KEY);
    expect(data.effectivePermissions.permissions).not.toContain(CREATE_PRODUCTS_KEY);
    await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
    await page.waitForLoadState('networkidle');
    await expect(byTestId(page, CREATE_PRODUCT_TEST_ID).count()).resolves.toBe(0);
  });
});
