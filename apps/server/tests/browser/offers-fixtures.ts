import type { Page } from 'playwright-core';
import { DASHBOARD_URL } from './dashboard-pages';
import { adminApi } from './store-switcher-fixtures';

/** The offer pages of the active store. */
export const OFFERS_LIST_PATH = '/stores/active/offers';
export const newOfferPath = (type: string, productId?: string): string =>
  `${OFFERS_LIST_PATH}/new?type=${type}${productId === undefined ? '' : `&productId=${productId}`}`;
export const offerEditorPath = (id: string): string => `${OFFERS_LIST_PATH}/${id}`;
export const productEditorPath = (id: string): string => `/stores/active/products/${id}`;

/** The editor URL a saved offer opens at; `new` is the create route, not an id. */
export const SAVED_OFFER_URL = /\/stores\/[^/]+\/offers\/(?!new\b)([^/?#]+)$/;

/** The seven built-in app types, in catalogue order (D2515). */
export const BUILT_IN_APP_TYPE_IDS = [
  'quantity',
  'free_delivery',
  'product_discount',
  'discount_codes',
  'bxgy',
  'order_discount',
  'addon',
] as const;

/** The shared section titles every editor shows (English catalogue), besides the kind's own card. */
export const SHARED_SECTION_TITLES = [
  'Name',
  'Offer settings',
  'How buyers get it',
  'Who gets it',
  'Shown on',
  'Dates and limits',
  'Combines with',
] as const;

/** The sample product's price (whole DZD): the preview prices its tiers on it. */
export const SAMPLE_PRICE = 4900;

/** A valid quantity configuration: 10 % off from two pieces (a draft is checked by its kind's schema, D2404). */
export const QUANTITY_CONFIG = {
  priceMode: 'percent',
  tiers: [{ quantity: 2, price: 10, preselected: false, freeDelivery: false }],
} as const;

/** A valid discount-codes configuration: 10 % off the whole order's products. */
export const CODES_CONFIG = {
  appliesTo: 'all',
  valueType: 'percent',
  value: 10,
  cap: null,
  showCountdown: false,
} as const;

/** A message id left untranslated on the page (`offers.editor-name`), which the catalogues must never show. */
export const RAW_OFFERS_MESSAGE_ID = /\boffers\.[a-z]+(-[a-z]+)+\b/;

/** The framework's name: only the licence footer may carry it (ADR 0007). */
export const VENDOR_NAME = /vendure/i;
const LICENCE_FOOTER = '[data-vendure-branding]';

export const open = (page: Page, path: string) =>
  page.goto(`${DASHBOARD_URL}${path}`, { waitUntil: 'domcontentloaded' });

/** A target of an offer as the Admin API takes it. */
interface TargetInput {
  readonly role: 'buy' | 'get' | 'addon';
  readonly refType: 'product' | 'variant';
  readonly refId: string;
}

/** What a test needs to create an offer over the Admin API. */
export interface OfferSeed {
  readonly kind: string;
  readonly title: string;
  readonly method?: 'automatic' | 'codes';
  readonly config?: unknown;
  readonly targets?: readonly TargetInput[];
}

/** A product of the active store at {@link SAMPLE_PRICE}, created through the catalog API. */
export async function createSampleProduct(page: Page, title: string): Promise<string> {
  const { createCatalogProduct } = await adminApi<{ createCatalogProduct: { product: { id: string } } }>(
    page,
    'mutation ($input: CreateCatalogProductInput!) { createCatalogProduct(input: $input) { product { id } } }',
    { input: { title, status: 'active', price: SAMPLE_PRICE } },
  );
  return createCatalogProduct.product.id;
}

export const deleteProduct = (page: Page, id: string) =>
  adminApi(page, 'mutation ($id: ID!) { deleteCatalogProduct(id: $id) }', { id });

/** A draft of the active store, created through the offers API. */
export async function createOfferDraft(page: Page, seed: OfferSeed): Promise<string> {
  const { createOffer } = await adminApi<{ createOffer: { id: string } }>(
    page,
    'mutation ($input: CreateOfferInput!) { createOffer(input: $input) { id } }',
    { input: seed },
  );
  return createOffer.id;
}

/** The status, tiers count and code count of an offer, as the Admin API answers. */
export interface OfferState {
  readonly status: string;
  readonly config: { readonly tiers?: readonly unknown[] } | null;
  readonly codeCount: number;
}

export async function offerState(page: Page, id: string): Promise<OfferState | null> {
  const { offer } = await adminApi<{ offer: OfferState | null }>(
    page,
    'query ($id: String!) { offer(id: $id) { status config codeCount } }',
    { id },
  );
  return offer;
}

export async function offerCodes(page: Page, offerId: string): Promise<readonly string[]> {
  const { offerCodes: codes } = await adminApi<{ offerCodes: readonly { code: string }[] }>(
    page,
    'query ($offerId: String!) { offerCodes(offerId: $offerId) { code } }',
    { offerId },
  );
  return codes.map((each) => each.code);
}

/** Removes a test's offer: a draft is deleted, a published one archived (only drafts delete, D2521). */
export async function removeOffer(page: Page, id: string): Promise<void> {
  const state = await offerState(page, id);
  if (state === null || state.status === 'archived') return;
  if (state.status === 'draft') await adminApi(page, 'mutation ($id: String!) { deleteOffer(id: $id) }', { id });
  else await adminApi(page, 'mutation ($id: String!) { archiveOffer(id: $id) { id } }', { id });
}

/** A whole amount as the Arabic preview writes it, formatted by the browser's own Intl (ar-DZ, Latin digits). */
export const previewAmount = (page: Page, amount: number): Promise<string> =>
  page.evaluate((value) => new Intl.NumberFormat('ar-DZ', { numberingSystem: 'latn' }).format(value), amount);

/** The page's visible text without the licence footer. */
export const textWithoutLicence = (page: Page): Promise<string> =>
  page.evaluate((footer: string) => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(footer).forEach((element) => {
      element.remove();
    });
    return clone.textContent;
  }, LICENCE_FOOTER);
