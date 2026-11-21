import {
  EDITOR_PRICE_TEST_ID,
  EDITOR_SAVE_TEST_ID,
  EDITOR_TITLE_TEST_ID,
  PRODUCT_EDITOR_TEST_ID,
} from '@cod/plugin-catalog';
import {
  PACK_BLOCK_TEST_ID,
  PACK_COMPONENT_ROW_TEST_ID,
  PACK_DISCOUNT_VALUE_TEST_ID,
  PACK_PICKER_OPTION_TEST_ID,
  PACK_PICKER_SEARCH_TEST_ID,
  PACK_PRICE_TEST_ID,
  PACK_SAVE_FIRST_TEST_ID,
  PACK_SAVE_TEST_ID,
} from '@cod/plugin-catalog-packs';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import { adminApi, byTestId } from './store-switcher-fixtures';

const NEW_PRODUCT_PATH = '/stores/active/products/new';
const EDITED_PRODUCT_URL = /\/stores\/[^/]+\/products\/(\d+)$/;
const runId = Date.now().toString(36);

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });

/** A physical product of the active store at `price` DZD, created through the catalog API. */
async function createProduct(page: Page, title: string, price: number): Promise<string> {
  const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
    page,
    'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    { input: { title, status: 'active', price } },
  );
  return createCatalogProduct.product.id;
}

const storedPrice = async (page: Page, id: string): Promise<number> =>
  (
    await adminApi<{ catalogProduct: { price: number } }>(
      page,
      'query ($id: ID!) { catalogProduct(id: $id) { price } }',
      {
        id,
      },
    )
  ).catalogProduct.price;

/** Picks `option` in the labelled select of the pack block. */
async function choose(page: Page, label: string, option: string): Promise<void> {
  await byTestId(page, PACK_BLOCK_TEST_ID).getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

describe('pack editor block', () => {
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
    // The pack first: a component of a stored pack is still a product the pack names.
    for (const id of created.splice(0).reverse())
      await adminApi(page, 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id });
    await page.context().close();
  });

  it('owner turns a new product into a 2-component pack and sees the computed price', async () => {
    // Arrange: two components of 1 500 and 2 000 DZD
    created.push(
      await createProduct(page, `Pack shirt ${runId}`, 1500),
      await createProduct(page, `Pack cap ${runId}`, 2000),
    );
    await open(page, NEW_PRODUCT_PATH);
    await byTestId(page, PRODUCT_EDITOR_TEST_ID).waitFor();
    await byTestId(page, PACK_SAVE_FIRST_TEST_ID).waitFor();
    await byTestId(page, EDITOR_TITLE_TEST_ID).fill(`Duo ${runId}`);
    await page.getByLabel('Product type', { exact: true }).click();
    await page.getByRole('option', { name: 'Pack', exact: true }).click();
    await byTestId(page, EDITOR_SAVE_TEST_ID).click();
    await page.waitForURL(EDITED_PRODUCT_URL);
    const packId = EDITED_PRODUCT_URL.exec(page.url())?.[1];
    if (packId === undefined) throw new Error('the editor opened the created pack');
    created.push(packId);

    // Act: 10 % off both components
    await byTestId(page, PACK_BLOCK_TEST_ID).waitFor();
    await choose(page, 'Discount', 'Percentage');
    await byTestId(page, PACK_DISCOUNT_VALUE_TEST_ID).fill('10');
    await byTestId(page, PACK_PICKER_SEARCH_TEST_ID).fill(runId);
    for (const title of [`Pack shirt ${runId}`, `Pack cap ${runId}`])
      await byTestId(page, PACK_PICKER_OPTION_TEST_ID).filter({ hasText: title }).click();
    await expect.poll(() => byTestId(page, PACK_COMPONENT_ROW_TEST_ID).count()).toBe(2);
    await byTestId(page, PACK_SAVE_TEST_ID).click();

    // Assert: (1 500 + 2 000) × 90 % = 3 150, shown and stored
    await expect.poll(() => byTestId(page, PACK_PRICE_TEST_ID).textContent()).toContain('3,150');
    await expect.poll(() => storedPrice(page, packId)).toBe(3150);
    // The editor's own read-only price follows the block's save without a reload (D2249).
    await expect.poll(() => byTestId(page, EDITOR_PRICE_TEST_ID).inputValue()).toBe('3150');
    await assertNoPageError(page);
  });
});
