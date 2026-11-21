import {
  ADD_QUANTITY_OFFER_TEST_ID,
  APP_TYPE_CARD_TEST_ID,
  ARABIC_PREVIEW_TEST_ID,
  CODES_PANEL_TEST_ID,
  CREATE_ALL_KINDS_TEST_ID,
  CREATE_BY_GOAL_TEST_ID,
  CREATE_DIALOG_TEST_ID,
  CREATE_OFFER_TEST_ID,
  EDITOR_PUBLISH_TEST_ID,
  OFFER_EDITOR_TEST_ID,
  OFFER_LIST_TEST_ID,
  PRODUCT_OFFER_ROW_TEST_ID,
  PRODUCT_OFFERS_TEST_ID,
} from '@cod/plugin-offers';
import { type Browser, chromium, type Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DASHBOARD_URL } from './dashboard-pages';
import { assertNoPageError, loginAsDemoOwner, setDisplayLanguage } from './dashboard-session';
import {
  BUILT_IN_APP_TYPE_IDS,
  CODES_CONFIG,
  createOfferDraft,
  createSampleProduct,
  deleteProduct,
  newOfferPath,
  OFFERS_LIST_PATH,
  offerCodes,
  offerEditorPath,
  offerState,
  open,
  previewAmount,
  QUANTITY_CONFIG,
  productEditorPath,
  RAW_OFFERS_MESSAGE_ID,
  removeOffer,
  SAMPLE_PRICE,
  SAVED_OFFER_URL,
  SHARED_SECTION_TITLES,
  textWithoutLicence,
  VENDOR_NAME,
} from './offers-fixtures';
import { byTestId } from './store-switcher-fixtures';

const runId = Date.now().toString(36);
/** The default quantity tier takes 10 % off two pieces; the 20 % chip replaces it (D2409: per unit, half-up). */
const UNIT_AT_TEN_PERCENT = SAMPLE_PRICE - SAMPLE_PRICE / 10;
const UNIT_AT_TWENTY_PERCENT = SAMPLE_PRICE - SAMPLE_PRICE / 5;
const GENERATED_PREFIX = 'BRW';
const GENERATED_COUNT = 3;

const editor = (page: Page) => byTestId(page, OFFER_EDITOR_TEST_ID);
const previewText = (page: Page) => byTestId(page, ARABIC_PREVIEW_TEST_ID).innerText();
/** How many pixels the widest element under the test id sticks out of its dashboard card, left or right (0 when none). */
const spillOutOfCard = (page: Page, testId: string): Promise<number> =>
  page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    if (root === null) throw new Error(`no ${id}`);
    const card = (root.closest('[data-slot="card"]') ?? root).getBoundingClientRect();
    const spills = [root, ...root.querySelectorAll('*')].map((element) => {
      const box = element.getBoundingClientRect();
      return box.width === 0 ? 0 : Math.max(card.left - box.left, box.right - card.right);
    });
    return Math.max(0, ...spills);
  }, testId);
const ALL_KINDS_TAB = 'All types';
const allKindsCard = (page: Page, id: string) =>
  byTestId(page, CREATE_ALL_KINDS_TEST_ID).locator(`[data-testid="${APP_TYPE_CARD_TEST_ID}"][data-app-type="${id}"]`);

/** Opens the create dialog from the list, on its first view. */
async function openCreateDialogOnFirstView(page: Page): Promise<void> {
  await open(page, OFFERS_LIST_PATH);
  await byTestId(page, OFFER_LIST_TEST_ID).waitFor();
  await byTestId(page, CREATE_OFFER_TEST_ID).click();
  await byTestId(page, CREATE_DIALOG_TEST_ID).waitFor();
}

/** Opens the create dialog from the list and shows every kind. */
async function openCreateDialog(page: Page): Promise<void> {
  await openCreateDialogOnFirstView(page);
  await byTestId(page, CREATE_DIALOG_TEST_ID).getByRole('tab', { name: ALL_KINDS_TAB }).click();
  await byTestId(page, CREATE_ALL_KINDS_TEST_ID).waitFor();
}

/**
 * Clicks a tab of the create dialog and counts the visible cards once React has committed the switch, before the
 * next frame: the moment a closing tab panel still shows if it waits for its exit to settle.
 */
const visibleCardsRightAfterTab = (page: Page, tabName: string): Promise<number> =>
  page.evaluate(
    async ([dialogId, cardId, name]) => {
      const tab = [...document.querySelectorAll(`[data-testid="${dialogId}"] [role="tab"]`)].find(
        (element) => element.textContent.trim() === name,
      );
      if (!(tab instanceof HTMLElement)) throw new Error(`no ${name} tab`);
      tab.click();
      await new Promise<void>((resolve) => {
        queueMicrotask(resolve);
      });
      return [...document.querySelectorAll(`[data-testid="${cardId}"]`)].filter((card) => card.checkVisibility())
        .length;
    },
    [CREATE_DIALOG_TEST_ID, APP_TYPE_CARD_TEST_ID, tabName] as const,
  );

describe('offers admin', () => {
  let browser: Browser;
  let page: Page;
  const offers: string[] = [];
  const products: string[] = [];

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
    for (const id of offers.splice(0)) await removeOffer(page, id);
    for (const id of products.splice(0)) await deleteProduct(page, id);
    await page.context().close();
  });

  const sampleProduct = async (): Promise<string> => {
    const id = await createSampleProduct(page, `Offer runner ${runId}`);
    products.push(id);
    return id;
  };

  const savedOfferId = async (): Promise<string> => {
    await page.waitForURL(SAVED_OFFER_URL);
    const id = SAVED_OFFER_URL.exec(new URL(page.url()).pathname)?.[1];
    if (id === undefined) throw new Error('the editor opened the saved offer');
    offers.push(id);
    return id;
  };

  it('shows only the chosen view of the create dialog, even on the frame of the switch', async () => {
    await openCreateDialogOnFirstView(page);
    await byTestId(page, CREATE_BY_GOAL_TEST_ID).waitFor();

    const visibleCards = await visibleCardsRightAfterTab(page, ALL_KINDS_TAB);

    expect(visibleCards).toBe(BUILT_IN_APP_TYPE_IDS.length);
    await expect.poll(() => byTestId(page, CREATE_BY_GOAL_TEST_ID).count()).toBe(0);
  });

  it('opens each of the seven editors from the create dialog', async () => {
    await openCreateDialog(page);
    await expect
      .poll(() => byTestId(page, CREATE_ALL_KINDS_TEST_ID).locator(`[data-testid="${APP_TYPE_CARD_TEST_ID}"]`).count())
      .toBe(BUILT_IN_APP_TYPE_IDS.length);

    for (const id of BUILT_IN_APP_TYPE_IDS) {
      await openCreateDialog(page);
      await allKindsCard(page, id).click();

      await page.waitForURL((url) => url.searchParams.get('type') === id);
      await editor(page).getByRole('heading', { name: 'New offer' }).waitFor();
      for (const title of SHARED_SECTION_TITLES) {
        await expect(editor(page).getByText(title, { exact: true }).first().isVisible()).resolves.toBe(true);
      }
      await assertNoPageError(page);
    }
  });

  it('creates and publishes a quantity offer with three tiers', async () => {
    const productId = await sampleProduct();
    await open(page, newOfferPath('quantity', productId));
    await editor(page).getByLabel('Offer name').fill(`Three tiers ${runId}`);
    await editor(page).getByRole('button', { name: 'Add a tier' }).click();
    await editor(page).getByRole('button', { name: 'Add a tier' }).click();

    await byTestId(page, EDITOR_PUBLISH_TEST_ID).click();

    const id = await savedOfferId();
    await expect.poll(async () => (await offerState(page, id))?.status).toBe('active');
    await expect(offerState(page, id).then((state) => state?.config?.tiers?.length)).resolves.toBe(3);
    await assertNoPageError(page);
  });

  it('updates the preview total when a tier percent changes', async () => {
    const productId = await sampleProduct();
    const atTen = await previewAmount(page, UNIT_AT_TEN_PERCENT);
    const atTwenty = await previewAmount(page, UNIT_AT_TWENTY_PERCENT);
    await open(page, newOfferPath('quantity', productId));
    await expect.poll(() => previewText(page)).toContain(atTen);

    await editor(page).getByRole('group', { name: 'Quick percents' }).getByRole('button', { name: /^20\b/ }).click();

    await expect.poll(() => previewText(page)).toContain(atTwenty);
    await expect(previewText(page)).resolves.not.toContain(atTen);
  });

  it('keeps every preview line inside its side card on a desktop screen', async () => {
    const productId = await sampleProduct();
    const atTen = await previewAmount(page, UNIT_AT_TEN_PERCENT);
    await open(page, newOfferPath('quantity', productId));
    await expect.poll(() => previewText(page)).toContain(atTen);

    await expect(spillOutOfCard(page, ARABIC_PREVIEW_TEST_ID)).resolves.toBeLessThanOrEqual(1);
  });

  it('shows the publish problems for an empty draft', async () => {
    const id = await createOfferDraft(page, {
      kind: 'quantity',
      title: `Empty draft ${runId}`,
      config: QUANTITY_CONFIG,
    });
    offers.push(id);
    await open(page, offerEditorPath(id));
    await byTestId(page, EDITOR_PUBLISH_TEST_ID).waitFor();

    await byTestId(page, EDITOR_PUBLISH_TEST_ID).click();

    await page.getByRole('alert').filter({ hasText: 'Choose the products this offer applies to.' }).first().waitFor();
    await expect(offerState(page, id).then((state) => state?.status)).resolves.toBe('draft');
  });

  it('generates codes on a discount-codes offer', async () => {
    const id = await createOfferDraft(page, {
      kind: 'product_discount',
      method: 'codes',
      title: `Codes ${runId}`,
      config: CODES_CONFIG,
    });
    offers.push(id);
    await open(page, offerEditorPath(id));
    const panel = byTestId(page, CODES_PANEL_TEST_ID);
    await panel.getByLabel('How many').fill(String(GENERATED_COUNT));
    await panel.getByLabel('Prefix').fill(GENERATED_PREFIX);

    await panel.getByRole('button', { name: 'Generate', exact: true }).click();

    await expect.poll(async () => (await offerCodes(page, id)).length).toBe(GENERATED_COUNT);
    const codes = await offerCodes(page, id);
    expect(codes.every((code) => code.startsWith(GENERATED_PREFIX))).toBe(true);
    for (const code of codes) await panel.getByText(code, { exact: true }).waitFor();
  });

  it('shows the offer in the product editor block', async () => {
    const productId = await sampleProduct();
    const title = `Block offer ${runId}`;
    const id = await createOfferDraft(page, {
      kind: 'quantity',
      title,
      config: QUANTITY_CONFIG,
      targets: [{ role: 'buy', refType: 'product', refId: productId }],
    });
    offers.push(id);

    await open(page, productEditorPath(productId));

    const row = byTestId(page, PRODUCT_OFFERS_TEST_ID).locator(
      `[data-testid="${PRODUCT_OFFER_ROW_TEST_ID}"][data-offer-id="${id}"]`,
    );
    await row.waitFor();
    await expect(row.innerText()).resolves.toContain(title);
    await byTestId(page, ADD_QUANTITY_OFFER_TEST_ID).waitFor();
    await assertNoPageError(page);
  });

  it('renders the editor right to left in Arabic', async () => {
    await setDisplayLanguage(page, 'ar');
    await open(page, newOfferPath('quantity'));

    await editor(page).getByRole('heading', { name: 'عرض جديد' }).waitFor();
    await expect(page.evaluate(() => document.documentElement.dir)).resolves.toBe('rtl');
    await page.waitForLoadState('networkidle');
    await expect(textWithoutLicence(page)).resolves.not.toMatch(RAW_OFFERS_MESSAGE_ID);
    await assertNoPageError(page);
  });

  it('shows no third-party product name', async () => {
    await openCreateDialog(page);
    await expect(textWithoutLicence(page)).resolves.not.toMatch(VENDOR_NAME);

    await open(page, newOfferPath('quantity'));
    await editor(page).getByRole('heading', { name: 'New offer' }).waitFor();
    await page.waitForLoadState('networkidle');

    await expect(textWithoutLicence(page)).resolves.not.toMatch(VENDOR_NAME);
  });
});
