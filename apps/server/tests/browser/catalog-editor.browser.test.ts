import {
  EDITOR_PRICE_TEST_ID,
  EDITOR_SAVE_TEST_ID,
  EDITOR_SKU_TEST_ID,
  EDITOR_TITLE_TEST_ID,
  OPTION_NAME_INPUT_TEST_ID,
  OPTION_VALUE_INPUT_TEST_ID,
  PRODUCT_EDITOR_TEST_ID,
  VARIANT_PRICE_TEST_ID,
  VARIANT_ROW_TEST_ID,
  VARIANT_SKU_TEST_ID,
} from '@cod/plugin-catalog';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import { adminApi, byTestId } from './store-switcher-fixtures';

const NEW_PRODUCT_PATH = '/stores/active/products/new';
const EDITED_PRODUCT_URL = /\/stores\/[^/]+\/products\/(\d+)$/;
const runId = Date.now().toString(36);

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const variantRows = (page: Page) => byTestId(page, VARIANT_ROW_TEST_ID);

interface VariantAnswer {
  readonly catalogProduct: { readonly variants: readonly { readonly sku: string; readonly price: number }[] };
}

/** Adds an option and its values through the editor's fields, pressing Enter after each. */
async function addOption(page: Page, index: number, name: string, values: readonly string[]): Promise<void> {
  await byTestId(page, OPTION_NAME_INPUT_TEST_ID).fill(name);
  await byTestId(page, OPTION_NAME_INPUT_TEST_ID).press('Enter');
  const valueInput = page.locator(
    `[data-testid="${OPTION_VALUE_INPUT_TEST_ID}"][data-option-index="${String(index)}"]`,
  );
  for (const value of values) {
    await valueInput.fill(value);
    await valueInput.press('Enter');
  }
}

const variantsOf = async (page: Page, id: string) =>
  (
    await adminApi<VariantAnswer>(page, 'query ($id: ID!) { catalogProduct(id: $id) { variants { sku price } } }', {
      id,
    })
  ).catalogProduct.variants;

describe('catalog product editor', () => {
  let browser: Browser;
  let page: Page;
  const created: string[] = [];

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
    for (const id of created.splice(0)) {
      await adminApi(page, 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id });
    }
    await page.context().close();
  });

  it('creates a product with Color and Size and shows four variants with skus -1 to -4', async () => {
    const sku = `ED${runId}`.toUpperCase();
    await open(page, NEW_PRODUCT_PATH);
    await byTestId(page, PRODUCT_EDITOR_TEST_ID).waitFor();
    await byTestId(page, EDITOR_TITLE_TEST_ID).fill(`Editor runner ${runId}`);
    await byTestId(page, EDITOR_PRICE_TEST_ID).fill('2500');
    await byTestId(page, EDITOR_SKU_TEST_ID).fill(sku);
    await addOption(page, 0, 'Color', ['Red', 'Blue']);
    await addOption(page, 1, 'Size', ['S', 'M']);

    await byTestId(page, EDITOR_SAVE_TEST_ID).click();

    await page.waitForURL(EDITED_PRODUCT_URL);
    const id = EDITED_PRODUCT_URL.exec(page.url())?.[1];
    if (id === undefined) throw new Error('the editor opened the created product');
    created.push(id);
    await expect.poll(() => variantRows(page).count()).toBe(4);
    // The image select of each row renders a hidden form input of its own, so the SKU is read by its test id.
    const skus = await byTestId(page, VARIANT_SKU_TEST_ID).evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
    expect(skus).toEqual([1, 2, 3, 4].map((n) => `${sku}-${String(n)}`));
    await assertNoPageError(page);
  });

  it('editing one variant price keeps the others', async () => {
    const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
      page,
      'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
      {
        input: {
          title: `Priced runner ${runId}`,
          status: 'active',
          price: 2500,
          sku: `PR${runId}`.toUpperCase(),
          optionGroups: [
            { name: 'Color', values: ['Red', 'Blue'] },
            { name: 'Size', values: ['S', 'M'] },
          ],
        },
      },
    );
    const { id } = createCatalogProduct.product;
    created.push(id);
    await open(page, `/stores/active/products/${id}`);
    await expect.poll(() => variantRows(page).count()).toBe(4);

    await byTestId(page, VARIANT_PRICE_TEST_ID).nth(1).fill('3100');
    await byTestId(page, EDITOR_SAVE_TEST_ID).click();

    await expect
      .poll(async () => (await variantsOf(page, id)).map((variant) => variant.price))
      .toEqual([2500, 3100, 2500, 2500]);
  });

  it('shows the variant of a product whose options give a single combination', async () => {
    const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
      page,
      'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
      {
        input: {
          title: `Single runner ${runId}`,
          status: 'active',
          price: 2500,
          sku: `SG${runId}`.toUpperCase(),
          optionGroups: [{ name: 'Color', values: ['Red'] }],
        },
      },
    );
    const { id } = createCatalogProduct.product;
    created.push(id);

    await open(page, `/stores/active/products/${id}`);

    await expect.poll(() => variantRows(page).count()).toBe(1);
    await expect(byTestId(page, VARIANT_SKU_TEST_ID).inputValue()).resolves.toBe(`SG${runId}-1`.toUpperCase());
    await assertNoPageError(page);
  });

  it.each(['999999999', 'abc'])('answers not found for the product id %s without an editable form', async (id) => {
    await open(page, `/stores/active/products/${id}`);

    await expect(page.getByRole('alert').filter({ hasText: 'Product not found.' }).waitFor()).resolves.toBeUndefined();
    await expect(byTestId(page, EDITOR_SAVE_TEST_ID).count()).resolves.toBe(0);
    await expect(byTestId(page, EDITOR_TITLE_TEST_ID).count()).resolves.toBe(0);
    await assertNoPageError(page);
  });

  it('the editor renders right-to-left in Arabic', async () => {
    await setDisplayLanguage(page, 'ar');
    await open(page, NEW_PRODUCT_PATH);

    await byTestId(page, PRODUCT_EDITOR_TEST_ID).waitFor();
    await expect(page.getByRole('heading', { level: 1 }).textContent()).resolves.toBe('منتج جديد');
    await expect(page.evaluate(() => document.documentElement.dir)).resolves.toBe('rtl');
    await assertNoPageError(page);
  });
});
