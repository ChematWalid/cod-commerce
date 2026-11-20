import { type BulkEditPriceMode, PRODUCT_STATUSES } from '@cod/shared';

/** One of the product statuses a bulk edit may set. */
export type BulkStatus = (typeof PRODUCT_STATUSES)[number];

/** The `brandId` choice that clears the brand of every selected product. */
export const CLEAR_BRAND = 'clear';
/** An empty choice: the field stays as each product has it. */
export const KEEP = '';

/** The bulk edit dialog's fields (D2213); each empty one leaves the products' value as it is. */
export interface BulkForm {
  readonly status: BulkStatus | typeof KEEP;
  /** A brand id, {@link CLEAR_BRAND}, or {@link KEEP}. */
  readonly brandId: string;
  readonly addTagId: string;
  readonly removeTagId: string;
  readonly priceMode: BulkEditPriceMode | typeof KEEP;
  readonly priceValue: string;
}

/** `CatalogBulkEditChangesInput`: only the fields the merchant changed. */
export interface BulkChanges {
  readonly status?: BulkStatus;
  readonly brandId?: string | null;
  readonly addTagIds?: readonly string[];
  readonly removeTagIds?: readonly string[];
  readonly price?: { readonly mode: BulkEditPriceMode; readonly value: number };
}

/** `CatalogBulkEditInput`. */
export interface BulkEditInput {
  readonly productIds: readonly string[];
  readonly changes: BulkChanges;
  readonly dryRun: boolean;
}

/** Where the dialog is (D2213): editing (its button runs a dry run), reviewed (its button applies), applied. */
export type BulkPhase = 'edit' | 'reviewed' | 'applied';

/** The input to send, or the catalogue id saying why the form cannot be sent. */
export type BulkRequest =
  { readonly ok: true; readonly input: BulkEditInput } | { readonly ok: false; readonly messageId: string };

export const BULK_NOTHING_CHANGED_MESSAGE_ID = 'catalog-import.bulk-nothing-changed';
export const BULK_PRICE_INVALID_MESSAGE_ID = 'catalog-import.bulk-price-invalid';

/** A signed decimal number as typed: digits, an optional sign and one decimal point. */
const NUMBER_TEXT = /^[-+]?\d+(?:[.]\d+)?$/;

/** A form that changes nothing. */
export const emptyBulkForm = (): BulkForm => ({
  status: KEEP,
  brandId: KEEP,
  addTagId: KEEP,
  removeTagId: KEEP,
  priceMode: KEEP,
  priceValue: '',
});

/** The price change typed, `undefined` when none is asked, `null` when the value is no number. */
function priceChangeOf(form: BulkForm): BulkChanges['price'] | null {
  if (form.priceMode === KEEP) return undefined;
  const text = form.priceValue.trim();
  if (!NUMBER_TEXT.test(text)) return null;
  return { mode: form.priceMode, value: Number(text) };
}

/** The status, brand and tag changes of the form; absent keys stay as they are. */
function taxonomyChangesOf(form: BulkForm): BulkChanges {
  return {
    ...(form.status === KEEP ? {} : { status: form.status }),
    ...(form.brandId === KEEP ? {} : { brandId: form.brandId === CLEAR_BRAND ? null : form.brandId }),
    ...(form.addTagId === KEEP ? {} : { addTagIds: [form.addTagId] }),
    ...(form.removeTagId === KEEP ? {} : { removeTagIds: [form.removeTagId] }),
  };
}

/**
 * The bulk edit to send for `productIds`: only the changed fields, as a dry run while editing and for real once the
 * merchant reviewed the dry run's answer (D2213). The server checks every value again (ADR 0017).
 */
export function bulkRequestOf(form: BulkForm, productIds: readonly string[], phase: BulkPhase): BulkRequest {
  const price = priceChangeOf(form);
  if (price === null) return { ok: false, messageId: BULK_PRICE_INVALID_MESSAGE_ID };
  const changes: BulkChanges = { ...taxonomyChangesOf(form), ...(price === undefined ? {} : { price }) };
  if (Object.keys(changes).length === 0) return { ok: false, messageId: BULK_NOTHING_CHANGED_MESSAGE_ID };
  return { ok: true, input: { productIds: [...productIds], changes, dryRun: phase === 'edit' } };
}

/** The phase after a successful request: a dry run leads to the review, an apply ends the dialog's work. */
export const nextBulkPhase = (phase: BulkPhase): BulkPhase => (phase === 'edit' ? 'reviewed' : 'applied');
