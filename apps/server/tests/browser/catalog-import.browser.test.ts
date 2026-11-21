import { PRODUCT_LIST_TEST_ID, PRODUCT_ROW_TEST_ID, PRODUCT_SEARCH_TEST_ID } from '@cod/plugin-catalog';
import {
  BULK_DIALOG_TEST_ID,
  BULK_EDIT_ACTION_TEST_ID,
  BULK_RESULT_TEST_ID,
  BULK_STATUS_TEST_ID,
  BULK_SUBMIT_TEST_ID,
  CATALOG_IMPORT_PAGE_TEST_ID,
  EXPORT_ACTION_TEST_ID,
  EXPORT_DIALOG_TEST_ID,
  EXPORT_DOWNLOAD_TEST_ID,
  EXPORT_SUBMIT_TEST_ID,
  IMPORT_CONFIRM_TEST_ID,
  IMPORT_CREATED_TEST_ID,
  IMPORT_FILE_INPUT_TEST_ID,
  IMPORT_MAPPING_NEXT_TEST_ID,
  IMPORT_PREVIEW_NEXT_TEST_ID,
  IMPORT_UPLOAD_TEST_ID,
} from '@cod/plugin-catalog-import';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import { adminApi, byTestId } from './store-switcher-fixtures';

const PRODUCTS_PATH = '/stores/active/products';
const IMPORT_PATH = '/stores/active/products/import';
/** Vendure's trigger of the action bar's dropdown menu. */
const ACTION_MENU_TEST_ID = 'action-bar-dropdown-trigger';
const IMPORTED_ROWS = 100;
const LIST_PAGE = 100;
const runId = Date.now().toString(36);

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });

/** A synthetic CSV of `rows` products, one variant each, whose SKUs carry this run's id. */
function syntheticCsv(rows: number): Buffer {
  const lines = ['product_key,name,status,price,variant_sku'];
  for (let index = 1; index <= rows; index += 1) {
    const sku = `IMP-${runId}-${String(index)}`;
    lines.push(`${sku},Imported ${runId} ${String(index)},active,${String(1000 + index)},${sku}`);
  }
  return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
}

/** A physical product of the active store, created through the catalog API. */
async function createProduct(page: Page, title: string): Promise<string> {
  const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
    page,
    'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    { input: { title, status: 'active', price: 1500 } },
  );
  return createCatalogProduct.product.id;
}

/** The ids of the active store's products whose title holds this run's id. */
async function productsOfRun(page: Page): Promise<string[]> {
  const { catalogProducts } = await adminApi<{ catalogProducts: { items: { id: string }[] } }>(
    page,
    'query ($options: CatalogProductListInput) { catalogProducts(options: $options) { items { id } } }',
    { options: { q: runId, take: LIST_PAGE } },
  );
  return catalogProducts.items.map(({ id }) => id);
}

const statusOf = async (page: Page, id: string): Promise<string> =>
  (
    await adminApi<{ catalogProduct: { status: string } }>(
      page,
      'query ($id: ID!) { catalogProduct(id: $id) { status } }',
      { id },
    )
  ).catalogProduct.status;

/** The product list narrowed to this run, its `count` first rows ticked. */
async function tickRunProducts(page: Page, count: number): Promise<void> {
  await open(page, PRODUCTS_PATH);
  await byTestId(page, PRODUCT_LIST_TEST_ID).waitFor();
  await byTestId(page, PRODUCT_SEARCH_TEST_ID).fill(runId);
  await expect.poll(() => byTestId(page, PRODUCT_ROW_TEST_ID).count()).toBe(count);
  for (let index = 0; index < count; index += 1)
    await byTestId(page, PRODUCT_ROW_TEST_ID).nth(index).getByRole('checkbox').click();
}

/** Opens the action bar's menu and picks one of this plugin's items. */
async function pickAction(page: Page, testId: string): Promise<void> {
  await byTestId(page, ACTION_MENU_TEST_ID).click();
  await byTestId(page, testId).click();
}

describe('catalog import, export and bulk edit', () => {
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
    await loginAsDemoOwner(page, DASHBOARD_URL);
    await setDisplayLanguage(page, 'en');
  });

  afterEach(async () => {
    for (let ids = await productsOfRun(page); ids.length > 0; ids = await productsOfRun(page))
      for (const id of ids) await adminApi(page, 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id });
    await page.context().close();
  });

  it('owner imports the 100-row CSV and sees 100 created', async () => {
    // Arrange
    await open(page, IMPORT_PATH);
    await byTestId(page, CATALOG_IMPORT_PAGE_TEST_ID).waitFor();

    // Act: upload → mapping → preview → confirm
    await byTestId(page, IMPORT_FILE_INPUT_TEST_ID).setInputFiles({
      name: 'products.csv',
      mimeType: 'text/csv',
      buffer: syntheticCsv(IMPORTED_ROWS),
    });
    await byTestId(page, IMPORT_UPLOAD_TEST_ID).click();
    await byTestId(page, IMPORT_MAPPING_NEXT_TEST_ID).click();
    await byTestId(page, IMPORT_PREVIEW_NEXT_TEST_ID).click();
    await byTestId(page, IMPORT_CONFIRM_TEST_ID).click();

    // Assert
    await expect
      .poll(() => byTestId(page, IMPORT_CREATED_TEST_ID).getAttribute('data-count'), { timeout: 60_000 })
      .toBe(String(IMPORTED_ROWS));
    await assertNoPageError(page);
  });

  it('owner exports selected products as CSV', async () => {
    // Arrange
    await createProduct(page, `Export ${runId} A`);
    await createProduct(page, `Export ${runId} B`);
    await tickRunProducts(page, 2);

    // Act
    await pickAction(page, EXPORT_ACTION_TEST_ID);
    const dialog = byTestId(page, EXPORT_DIALOG_TEST_ID);
    await dialog.getByLabel('Format', { exact: true }).click();
    await page.getByRole('option', { name: 'CSV', exact: true }).click();
    await byTestId(page, EXPORT_SUBMIT_TEST_ID).click();

    // Assert: two rows written, and the file downloads as CSV
    await expect.poll(() => byTestId(page, EXPORT_DOWNLOAD_TEST_ID).getAttribute('data-row-count')).toBe('2');
    const opened = page.context().waitForEvent('page');
    await byTestId(page, EXPORT_DOWNLOAD_TEST_ID).click();
    const download = await (await opened).waitForEvent('download');
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    await assertNoPageError(page);
  });

  it('owner bulk-sets Draft on 2 products', async () => {
    // Arrange
    const ids = [await createProduct(page, `Bulk ${runId} A`), await createProduct(page, `Bulk ${runId} B`)];
    await tickRunProducts(page, 2);

    // Act: dry run, then apply
    await pickAction(page, BULK_EDIT_ACTION_TEST_ID);
    await byTestId(page, BULK_DIALOG_TEST_ID).waitFor();
    await byTestId(page, BULK_STATUS_TEST_ID).click();
    await page.getByRole('option', { name: 'Draft', exact: true }).click();
    await byTestId(page, BULK_SUBMIT_TEST_ID).click();
    await expect.poll(() => byTestId(page, BULK_RESULT_TEST_ID).getAttribute('data-phase')).toBe('reviewed');
    expect(await Promise.all(ids.map((id) => statusOf(page, id)))).toEqual(['active', 'active']);
    await byTestId(page, BULK_SUBMIT_TEST_ID).click();

    // Assert
    await expect.poll(() => byTestId(page, BULK_RESULT_TEST_ID).getAttribute('data-phase')).toBe('applied');
    await expect.poll(() => Promise.all(ids.map((id) => statusOf(page, id)))).toEqual(['draft', 'draft']);
    await assertNoPageError(page);
  });
});
