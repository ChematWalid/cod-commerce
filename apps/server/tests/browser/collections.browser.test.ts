import {
  EDITOR_SAVE_TEST_ID,
  EDITOR_TITLE_TEST_ID,
  PRODUCT_LIST_TEST_ID,
  PRODUCT_ROW_TEST_ID,
} from '@cod/plugin-catalog';
import {
  ADD_CONDITION_TEST_ID,
  ADD_PRODUCTS_TEST_ID,
  COLLECTION_EDITOR_TEST_ID,
  COLLECTION_LIST_TEST_ID,
  COLLECTION_MATCH_ANY_TEST_ID,
  COLLECTION_MODE_TEST_ID,
  COLLECTION_ROW_TEST_ID,
  COLLECTION_SAVE_TEST_ID,
  COLLECTION_TITLE_TEST_ID,
  CONDITION_ROW_TEST_ID,
  CREATE_COLLECTION_TEST_ID,
  MANUAL_PRODUCT_ROW_TEST_ID,
  MODE_SWITCH_CONFIRM_TEST_ID,
  PREVIEW_COUNT_TEST_ID,
  PRODUCT_COLLECTIONS_BLOCK_TEST_ID,
  PRODUCT_COLLECTIONS_SAVE_TEST_ID,
} from '@cod/plugin-collections-rules';
import { type Browser, chromium, type Locator, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as seed from './collections-fixtures';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, loginAsOwner, setDisplayLanguage } from './dashboard-session';
import { byTestId } from './store-switcher-fixtures';

const PER_STORE_MEMBER_EMAIL = 'perstore@demo.example.test';
const LIST_PATH = '/stores/active/collections';
const NEW_PATH = `${LIST_PATH}/new`;
const EDITED_COLLECTION_URL = /\/stores\/[^/]+\/collections\/(\d+)$/;
const runId = Date.now().toString(36);

const open = (page: Page, path: string) => page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });
const conditionRow = (page: Page, index: number) => byTestId(page, CONDITION_ROW_TEST_ID).nth(index);
const previewCount = (page: Page) => byTestId(page, PREVIEW_COUNT_TEST_ID).getAttribute('data-count');

/** Ticks the checkbox `name` labels inside `within`. */
const tick = (within: Page | Locator, name: string) => within.getByRole('checkbox', { name, exact: true }).click();

/** Adds a condition row (Tag first). */
async function addCondition(page: Page): Promise<void> {
  await byTestId(page, ADD_CONDITION_TEST_ID).click();
}

/** Turns the editor's collection automatic. */
async function makeAutomatic(page: Page): Promise<void> {
  await byTestId(page, COLLECTION_MODE_TEST_ID).locator('[data-mode="automatic"]').click();
}

describe('collections pages', () => {
  let browser: Browser;
  let page: Page;
  const cleanups: (() => Promise<unknown>)[] = [];

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
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    await page.context().close();
  });

  const product = async (input: seed.ProductSeed): Promise<string> => {
    const id = await seed.createProduct(page, input);
    cleanups.push(() => seed.deleteProduct(page, id));
    return id;
  };
  const manualCollection = async (title: string, change: { readonly visible?: boolean } = {}): Promise<string> => {
    const id = await seed.createManualCollection(page, title, change);
    cleanups.push(() => seed.deleteCollection(page, id));
    return id;
  };

  it('creates an automatic collection: All/Any, Tag and Color rows, preview count changes without saving, saved list shows it', async () => {
    const tagName = `promo-${runId}`;
    const color = `Color ${runId}`;
    const tagId = await seed.createTag(page, tagName);
    cleanups.push(() => seed.deleteTag(page, tagId));
    await product({ title: `Red promo ${runId}`, tagIds: [tagId], options: [{ name: color, values: ['Red'] }] });
    await product({ title: `Blue promo ${runId}`, tagIds: [tagId], options: [{ name: color, values: ['Blue'] }] });
    await product({ title: `Red plain ${runId}`, options: [{ name: color, values: ['Red'] }] });
    const title = `Auto ${runId}`;

    await open(page, NEW_PATH);
    await byTestId(page, COLLECTION_TITLE_TEST_ID).fill(title);
    await makeAutomatic(page);
    await addCondition(page);
    await tick(conditionRow(page, 0), tagName);
    await addCondition(page);
    await conditionRow(page, 1).getByRole('combobox', { name: 'Field' }).click();
    await page.getByRole('option', { name: color }).click();
    await tick(conditionRow(page, 1), 'Red');

    await expect.poll(() => previewCount(page)).toBe('1');
    await byTestId(page, COLLECTION_MATCH_ANY_TEST_ID).click();
    await expect.poll(async () => Number(await previewCount(page))).toBeGreaterThanOrEqual(3);
    await expect(seed.collectionIdsMatching(page, title)).resolves.toEqual([]);

    await byTestId(page, COLLECTION_SAVE_TEST_ID).click();
    await page.waitForURL(EDITED_COLLECTION_URL);
    const [, savedId = ''] = EDITED_COLLECTION_URL.exec(page.url()) ?? [];
    cleanups.push(() => seed.deleteCollection(page, savedId));
    await open(page, LIST_PATH);
    await expect
      .poll(() => byTestId(page, COLLECTION_ROW_TEST_ID).allInnerTexts())
      .toContainEqual(expect.stringContaining(title));
    await assertNoPageError(page);
  });

  it('switching a manual collection to automatic asks for confirmation', async () => {
    const tagName = `switch-${runId}`;
    const tagId = await seed.createTag(page, tagName);
    cleanups.push(() => seed.deleteTag(page, tagId));
    const productId = await product({ title: `Switch ${runId}`, tagIds: [tagId] });
    const id = await manualCollection(`Switch ${runId}`);
    await seed.setCollectionProducts(page, id, [productId]);

    await open(page, `${LIST_PATH}/${id}`);
    await makeAutomatic(page);
    await addCondition(page);
    await tick(conditionRow(page, 0), tagName);
    await byTestId(page, COLLECTION_SAVE_TEST_ID).click();

    await byTestId(page, MODE_SWITCH_CONFIRM_TEST_ID).waitFor();
  });

  it('manual collection: add three products, reorder, reload keeps the order', async () => {
    const ids = [
      await product({ title: `Order A ${runId}` }),
      await product({ title: `Order B ${runId}` }),
      await product({ title: `Order C ${runId}` }),
    ];
    await open(page, NEW_PATH);
    await byTestId(page, COLLECTION_TITLE_TEST_ID).fill(`Manual ${runId}`);
    await byTestId(page, ADD_PRODUCTS_TEST_ID).click();
    await page.getByLabel('Search products by title').fill(runId);
    for (const letter of ['A', 'B', 'C']) await tick(page, `Order ${letter} ${runId}`);
    await page.getByRole('button', { name: 'Add selected (3)' }).click();
    await expect.poll(() => byTestId(page, MANUAL_PRODUCT_ROW_TEST_ID).count()).toBe(3);
    await byTestId(page, MANUAL_PRODUCT_ROW_TEST_ID)
      .first()
      .getByLabel('Move (drag, or use the arrow keys)')
      .press('ArrowDown');
    await byTestId(page, COLLECTION_SAVE_TEST_ID).click();
    await page.waitForURL(EDITED_COLLECTION_URL);
    const [, savedId = ''] = EDITED_COLLECTION_URL.exec(page.url()) ?? [];
    cleanups.push(() => seed.deleteCollection(page, savedId));

    await page.reload({ waitUntil: 'domcontentloaded' });

    const expected = [ids[1], ids[0], ids[2]];
    await expect
      .poll(() =>
        byTestId(page, MANUAL_PRODUCT_ROW_TEST_ID).evaluateAll((rows) => rows.map((row) => row.dataset['productId'])),
      )
      .toEqual(expected);
    await expect(seed.collectionProductIds(page, savedId)).resolves.toEqual(expected);
  });

  it('visibility off shows Hidden in the list', async () => {
    const title = `Hidden ${runId}`;
    await manualCollection(title, { visible: false });

    await open(page, LIST_PATH);

    const row = byTestId(page, COLLECTION_ROW_TEST_ID).filter({ hasText: title });
    await expect.poll(() => row.innerText()).toContain('Hidden');
  });

  it('the product editor block adds a manual collection, the editor own save keeps it, and the list filter narrows by collection', async () => {
    const collectionTitle = `Block ${runId}`;
    const collectionId = await manualCollection(collectionTitle);
    const productId = await product({ title: `Block product ${runId}` });

    await open(page, `/stores/active/products/${productId}`);
    const block = byTestId(page, PRODUCT_COLLECTIONS_BLOCK_TEST_ID);
    await tick(block, collectionTitle);
    await byTestId(page, PRODUCT_COLLECTIONS_SAVE_TEST_ID).click();
    await expect.poll(() => seed.manualCollectionsOf(page, productId)).toEqual([collectionId]);
    await byTestId(page, EDITOR_TITLE_TEST_ID).fill(`Block product renamed ${runId}`);
    await byTestId(page, EDITOR_SAVE_TEST_ID).click();
    await expect.poll(() => page.getByText('Block product renamed').count()).toBeGreaterThan(0);
    await expect(seed.manualCollectionsOf(page, productId)).resolves.toEqual([collectionId]);

    await open(page, '/stores/active/products');
    await byTestId(page, PRODUCT_LIST_TEST_ID).getByRole('combobox', { name: 'All collections' }).click();
    await page.getByRole('option', { name: collectionTitle }).click();
    await expect
      .poll(() => byTestId(page, PRODUCT_ROW_TEST_ID).allInnerTexts())
      .toEqual([expect.stringContaining(`Block product renamed ${runId}`)]);
  });

  it('Arabic: dir=rtl and no raw message id', async () => {
    await setDisplayLanguage(page, 'ar');
    await open(page, NEW_PATH);
    await byTestId(page, COLLECTION_EDITOR_TEST_ID).waitFor();
    await makeAutomatic(page);
    await addCondition(page);
    await byTestId(page, PREVIEW_COUNT_TEST_ID).waitFor();

    await expect(page.evaluate(() => document.documentElement.dir)).resolves.toBe('rtl');
    await expect(page.locator('body').innerText()).resolves.not.toMatch(/collections\.[a-z]/);
  });
});

describe('collections pages for a member', () => {
  it('perstore member without create sees no Create button', async () => {
    const browser = await chromium.launch();
    try {
      const page = await (await browser.newContext()).newPage();
      await loginAsOwner(page, DASHBOARD_URL, PER_STORE_MEMBER_EMAIL);
      await setDisplayLanguage(page, 'en');

      await open(page, LIST_PATH);
      await page.waitForLoadState('networkidle');

      await expect(byTestId(page, CREATE_COLLECTION_TEST_ID).count()).resolves.toBe(0);
      await expect(byTestId(page, COLLECTION_LIST_TEST_ID).locator('text=collections.').count()).resolves.toBe(0);
    } finally {
      await browser.close();
    }
  });
});
